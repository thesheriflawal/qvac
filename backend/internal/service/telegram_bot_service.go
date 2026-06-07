package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	telegramclient "github.com/Kynettic-org/kynettic-backend/internal/clients/telegram"
	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
)

// TelegramBotService handles incoming Telegram commands and outgoing alerts.
// It implements AlertSender so it can be wired into AnomalyService.
type TelegramBotService struct {
	client *telegramclient.Client

	// subscribedChats is the set of chat IDs that have opted in to alerts.
	mu             sync.RWMutex
	subscribedChats map[int64]bool

	// adminChatID receives all anomaly + agent alerts regardless of subscription.
	adminChatID int64
}

// NewTelegramBotService constructs the service. adminChatID (0 = disabled) receives
// all alerts unconditionally. Other users must /start to subscribe.
func NewTelegramBotService(client *telegramclient.Client, adminChatID int64) *TelegramBotService {
	return &TelegramBotService{
		client:          client,
		subscribedChats: make(map[int64]bool),
		adminChatID:     adminChatID,
	}
}

// ── AlertSender implementation ────────────────────────────────────────────

// SendAnomalyAlert broadcasts a P2P fraud alert to all subscribers.
// Implements AlertSender, safe to call from a goroutine.
func (s *TelegramBotService) SendAnomalyAlert(ctx context.Context, score *models.AnomalyScore, input AnomalyInput) {
	if !s.client.IsConfigured() {
		return
	}
	msg := AnomalyAlertMessage(score, input)
	s.broadcast(ctx, msg)
}

// SendAgentDecisionAlert notifies subscribers of an agent trade decision.
func (s *TelegramBotService) SendAgentDecisionAlert(ctx context.Context, agentName, action, asset string, amountUSD decimal.Decimal, reasoning, txRef string) {
	if !s.client.IsConfigured() || action == "hold" {
		return
	}
	emoji := "📈"
	if action == "sell" {
		emoji = "📉"
	}
	msg := fmt.Sprintf(
		`%s *Agent Decision* — %s

Action: *%s %s* ($%s)
_%s_

On-chain: ` + "`%s`",
		emoji, agentName,
		strings.ToUpper(action), asset, amountUSD.StringFixed(2),
		reasoning,
		txRef,
	)
	s.broadcast(ctx, msg)
}

// SendLargeTradeAlert fires when a P2P trade exceeds the USD threshold.
func (s *TelegramBotService) SendLargeTradeAlert(ctx context.Context, adType, asset string, amount decimal.Decimal, priceNGN decimal.Decimal) {
	if !s.client.IsConfigured() {
		return
	}
	f, _ := amount.Float64()
	if f < 1000 {
		return // only alert for $1 000+ trades
	}
	msg := fmt.Sprintf(
		`🐋 *Large Trade Detected*

%s *%s* — $%s
Price: ₦%s`,
		strings.ToUpper(adType), asset,
		amount.StringFixed(2),
		priceNGN.StringFixed(2),
	)
	s.broadcast(ctx, msg)
}

// broadcast sends msg to admin + all subscribed chats.
func (s *TelegramBotService) broadcast(ctx context.Context, msg string) {
	targets := s.targets()
	for _, chatID := range targets {
		if err := s.client.SendMarkdown(ctx, chatID, msg); err != nil {
			logger.FromCtx(ctx).Warn("telegram: send failed",
				zap.Int64("chat_id", chatID),
				zap.Error(err),
			)
		}
	}
}

func (s *TelegramBotService) targets() []int64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	seen := make(map[int64]bool)
	var out []int64
	if s.adminChatID != 0 {
		out = append(out, s.adminChatID)
		seen[s.adminChatID] = true
	}
	for id := range s.subscribedChats {
		if !seen[id] {
			out = append(out, id)
		}
	}
	return out
}

// ── Command Handler ───────────────────────────────────────────────────────

// HandleUpdate processes one incoming Telegram update. Called either from
// the webhook handler or the polling loop.
func (s *TelegramBotService) HandleUpdate(ctx context.Context, update telegramclient.Update) {
	if update.Message == nil {
		return
	}
	msg := update.Message
	text := strings.TrimSpace(msg.Text)
	chatID := msg.Chat.ID

	switch {
	case text == "/start" || strings.HasPrefix(text, "/start "):
		s.mu.Lock()
		s.subscribedChats[chatID] = true
		s.mu.Unlock()
		_ = s.client.SendMarkdown(ctx, chatID,
			"🤖 *Welcome to the Mantle AI Agent Monitor*\n\n"+
				"You are now subscribed to alerts.\n\n"+
				"Commands:\n"+
				"/status — live Mantle network status\n"+
				"/top — top P2P traders\n"+
				"/agents — deployed AI agents summary\n"+
				"/stop — unsubscribe from alerts",
		)

	case text == "/stop":
		s.mu.Lock()
		delete(s.subscribedChats, chatID)
		s.mu.Unlock()
		_ = s.client.SendMessage(ctx, chatID, "You have been unsubscribed from alerts.")

	case text == "/status":
		s.handleStatus(ctx, chatID)

	case text == "/top":
		s.handleTopTraders(ctx, chatID)

	case text == "/agents":
		s.handleAgentsSummary(ctx, chatID)

	default:
		_ = s.client.SendMessage(ctx, chatID,
			"Unknown command. Use /start to see available commands.",
		)
	}
}

func (s *TelegramBotService) handleStatus(ctx context.Context, chatID int64) {
	// Pull live counts from DB.
	var (
		activeAgents int64
		openOrders   int64
		recentTrades int64
	)
	db := database.GetDB().WithContext(ctx)
	db.Model(&models.Agent{}).Where("status = 'active'").Count(&activeAgents)
	db.Model(&models.P2POrder{}).Where("status IN ?", []string{"pending", "paid"}).Count(&openOrders)
	db.Model(&models.P2POrder{}).
		Where("status = 'completed' AND created_at > ?", time.Now().Add(-24*time.Hour)).
		Count(&recentTrades)

	msg := fmt.Sprintf(
		`📊 *Mantle AI Platform Status*

🤖 Active AI agents: %d
📋 Open P2P orders: %d
✅ Trades (24h): %d
⛓ Network: Mantle Testnet (5003)
🕐 %s UTC`,
		activeAgents, openOrders, recentTrades,
		time.Now().UTC().Format("15:04"),
	)
	_ = s.client.SendMarkdown(ctx, chatID, msg)
}

func (s *TelegramBotService) handleTopTraders(ctx context.Context, chatID int64) {
	type row struct {
		UserID       string
		TradeCount   int64
		TotalVolume  float64
	}
	var rows []row
	database.GetDB().WithContext(ctx).Raw(`
		SELECT
			u.uid AS user_id,
			COUNT(*) AS trade_count,
			COALESCE(SUM(CAST(o.amount AS FLOAT)), 0) AS total_volume
		FROM p2p_orders o
		JOIN users u ON u.id = o.buyer_id OR u.id = o.seller_id
		WHERE o.status = 'completed'
		GROUP BY u.uid
		ORDER BY trade_count DESC
		LIMIT 5`,
	).Scan(&rows)

	if len(rows) == 0 {
		_ = s.client.SendMessage(ctx, chatID, "No completed trades yet.")
		return
	}

	lines := "🏆 *Top P2P Traders*\n\n"
	medals := []string{"🥇", "🥈", "🥉", "4️⃣", "5️⃣"}
	for i, r := range rows {
		medal := medals[i]
		lines += fmt.Sprintf("%s UID %s — %d trades ($%.0f)\n", medal, r.UserID, r.TradeCount, r.TotalVolume)
	}
	_ = s.client.SendMarkdown(ctx, chatID, lines)
}

func (s *TelegramBotService) handleAgentsSummary(ctx context.Context, chatID int64) {
	var agents []models.Agent
	database.GetDB().WithContext(ctx).
		Where("status = 'active'").
		Order("total_executed DESC").
		Limit(5).
		Find(&agents)

	if len(agents) == 0 {
		_ = s.client.SendMessage(ctx, chatID, "No active AI agents deployed yet.")
		return
	}

	lines := "🤖 *Active AI Agents*\n\n"
	for _, a := range agents {
		pnl, _ := a.ProfitLossUSD.Float64()
		sign := "+"
		if pnl < 0 {
			sign = ""
		}
		lines += fmt.Sprintf("• *%s* — %d trades, PnL: %s$%.2f\n", a.Name, a.TotalExecuted, sign, pnl)
	}
	_ = s.client.SendMarkdown(ctx, chatID, lines)
}

// ── Polling Loop ──────────────────────────────────────────────────────────

// StartPolling runs a background goroutine that polls Telegram for updates.
// Use this during development instead of a webhook. Blocks until ctx is done.
func (s *TelegramBotService) StartPolling(ctx context.Context) {
	if !s.client.IsConfigured() {
		logger.FromCtx(ctx).Info("telegram: bot token not set — polling disabled")
		return
	}

	me, err := s.client.GetMe(ctx)
	if err != nil {
		logger.FromCtx(ctx).Warn("telegram: GetMe failed — polling disabled", zap.Error(err))
		return
	}
	logger.FromCtx(ctx).Info("telegram: bot started", zap.String("username", me.Username))

	var offset int64
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			updates, err := s.client.GetUpdates(ctx, offset)
			if err != nil {
				logger.FromCtx(ctx).Warn("telegram: getUpdates error", zap.Error(err))
				continue
			}
			for _, u := range updates {
				offset = u.UpdateID + 1
				s.HandleUpdate(ctx, u)
			}
		}
	}
}
