package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
)

// AnomalyService scores P2P trade attempts for fraud and suspicious patterns.
type AnomalyService interface {
	// ScoreTrade evaluates a pending trade and returns an AnomalyScore.
	// It persists the result to the database and (optionally) fires alerts.
	// If the score is CRITICAL, the caller should abort the trade.
	ScoreTrade(ctx context.Context, input AnomalyInput) (*models.AnomalyScore, error)

	// ListScores returns recent anomaly scores with optional filters.
	ListScores(ctx context.Context, filter AnomalyFilter, page, pageSize int) ([]models.AnomalyScore, int64, error)
}

// AnomalyInput holds the context of a trade attempt to be scored.
type AnomalyInput struct {
	TakerID     uuid.UUID
	MakerID     uuid.UUID
	AdID        uuid.UUID
	AdType      string // "buy" or "sell"
	CryptoAsset string
	AmountUSD   decimal.Decimal
	Price       decimal.Decimal
	MarketPrice decimal.Decimal // current market price (0 = unknown)
}

// AnomalyFilter for the admin list endpoint.
type AnomalyFilter struct {
	UserID    uuid.UUID
	RiskLevel string // low, medium, high, critical
	Blocked   *bool
	From      *time.Time
	To        *time.Time
}

// AlertSender is any service that can broadcast an anomaly alert.
// Both the Telegram bot and future Discord/Slack integrations implement this.
type AlertSender interface {
	SendAnomalyAlert(ctx context.Context, score *models.AnomalyScore, input AnomalyInput)
}

type anomalyService struct {
	alertSender AlertSender // optional; nil = no alerts
}

// NewAnomalyService constructs an AnomalyService. alertSender may be nil.
func NewAnomalyService(alertSender AlertSender) AnomalyService {
	return &anomalyService{alertSender: alertSender}
}

// ── Scoring Rules ─────────────────────────────────────────────────────────
// Each rule returns (score contribution 0-100, flag name).
// Final score = min(sum of contributions, 100).

type scoredRule struct {
	points int
	flag   string
}

func (s *anomalyService) ScoreTrade(ctx context.Context, input AnomalyInput) (*models.AnomalyScore, error) {
	db := database.GetDB().WithContext(ctx)
	rules := s.evaluateRules(ctx, input)

	total := 0
	flags := make([]string, 0, len(rules))
	for _, r := range rules {
		total += r.points
		if r.points > 0 {
			flags = append(flags, r.flag)
		}
	}
	if total > 100 {
		total = 100
	}

	flagsJSON, _ := json.Marshal(flags)
	score := &models.AnomalyScore{
		UserID:    input.TakerID,
		AdID:      input.AdID,
		Score:     total,
		RiskLevel: models.RiskLevelFromScore(total),
		FlagsJSON: string(flagsJSON),
		Flags:     flags,
		AmountUSD: input.AmountUSD,
		Blocked:   total >= 76,
	}

	if err := db.Create(score).Error; err != nil {
		logger.FromCtx(ctx).Warn("anomaly: failed to persist score", zap.Error(err))
	}

	if total > 25 {
		logger.FromCtx(ctx).Info("anomaly score",
			zap.String("user_id", input.TakerID.String()),
			zap.Int("score", total),
			zap.String("risk", score.RiskLevel),
			zap.Strings("flags", flags),
		)
	}

	// Fire alert asynchronously so it never slows down the trade path.
	if s.alertSender != nil && total >= 51 {
		go s.alertSender.SendAnomalyAlert(ctx, score, input)
	}

	return score, nil
}

// evaluateRules runs all detection rules and returns their contributions.
func (s *anomalyService) evaluateRules(ctx context.Context, input AnomalyInput) []scoredRule {
	db := database.GetDB().WithContext(ctx)
	var rules []scoredRule

	// ── Rule 1: Velocity — too many orders in a short window ─────────────────
	{
		var count int64
		db.Model(&models.P2POrder{}).
			Where("(buyer_id = ? OR seller_id = ?) AND created_at > ?",
				input.TakerID, input.TakerID, time.Now().Add(-1*time.Hour)).
			Count(&count)
		if count >= 10 {
			rules = append(rules, scoredRule{30, "velocity_extreme"})
		} else if count >= 5 {
			rules = append(rules, scoredRule{15, "velocity_high"})
		}
	}

	// ── Rule 2: New account + large trade ────────────────────────────────────
	{
		var user models.User
		if db.Select("created_at").First(&user, "id = ?", input.TakerID).Error == nil {
			age := time.Since(user.CreatedAt)
			if age < 7*24*time.Hour && input.AmountUSD.GreaterThan(decimal.NewFromInt(500)) {
				rules = append(rules, scoredRule{25, "new_account_large_trade"})
			} else if age < 3*24*time.Hour {
				rules = append(rules, scoredRule{15, "new_account"})
			}
		}
	}

	// ── Rule 3: Repeat counterparty (circular trading pattern) ───────────────
	{
		var count int64
		db.Model(&models.P2POrder{}).
			Where("(buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?)",
				input.TakerID, input.MakerID,
				input.MakerID, input.TakerID,
			).
			Where("created_at > ?", time.Now().Add(-24*time.Hour)).
			Count(&count)
		if count >= 5 {
			rules = append(rules, scoredRule{35, "repeat_counterparty_extreme"})
		} else if count >= 3 {
			rules = append(rules, scoredRule{20, "repeat_counterparty"})
		}
	}

	// ── Rule 4: Price deviation from market ──────────────────────────────────
	{
		if input.MarketPrice.IsPositive() && input.Price.IsPositive() {
			deviation := input.Price.Sub(input.MarketPrice).Div(input.MarketPrice).Abs()
			if deviation.GreaterThan(decimal.NewFromFloat(0.30)) {
				rules = append(rules, scoredRule{25, "price_deviation_extreme"})
			} else if deviation.GreaterThan(decimal.NewFromFloat(0.15)) {
				rules = append(rules, scoredRule{10, "price_deviation_high"})
			}
		}
	}

	// ── Rule 5: Amount outlier vs user history ────────────────────────────────
	{
		type avgRow struct{ Avg float64 }
		var row avgRow
		db.Raw(`
			SELECT COALESCE(AVG(CAST(amount AS FLOAT)), 0) AS avg
			FROM p2p_orders
			WHERE (buyer_id = ? OR seller_id = ?)
			  AND status = 'completed'
			  AND created_at > ?`,
			input.TakerID, input.TakerID, time.Now().Add(-30*24*time.Hour),
		).Scan(&row)

		if row.Avg > 0 {
			avgAmt := decimal.NewFromFloat(row.Avg)
			ratio := input.AmountUSD.Div(avgAmt)
			if ratio.GreaterThan(decimal.NewFromInt(10)) {
				rules = append(rules, scoredRule{30, "amount_extreme_outlier"})
			} else if ratio.GreaterThan(decimal.NewFromInt(5)) {
				rules = append(rules, scoredRule{15, "amount_outlier"})
			}
		}
	}

	// ── Rule 6: Self-trade detection ─────────────────────────────────────────
	{
		if input.TakerID == input.MakerID {
			// This should be caught by the p2p service, but score it anyway.
			rules = append(rules, scoredRule{100, "self_trade"})
		}
	}

	// ── Rule 7: Unusual hour (00:00–04:00 UTC, low-liquidity window) ─────────
	{
		hour := time.Now().UTC().Hour()
		if hour >= 0 && hour < 4 {
			rules = append(rules, scoredRule{5, "unusual_hour"})
		}
	}

	return rules
}

func (s *anomalyService) ListScores(ctx context.Context, filter AnomalyFilter, page, pageSize int) ([]models.AnomalyScore, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	db := database.GetDB().WithContext(ctx).Model(&models.AnomalyScore{})

	if filter.UserID != uuid.Nil {
		db = db.Where("user_id = ?", filter.UserID)
	}
	if filter.RiskLevel != "" {
		db = db.Where("risk_level = ?", filter.RiskLevel)
	}
	if filter.Blocked != nil {
		db = db.Where("blocked = ?", *filter.Blocked)
	}
	if filter.From != nil {
		db = db.Where("created_at >= ?", *filter.From)
	}
	if filter.To != nil {
		db = db.Where("created_at <= ?", *filter.To)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var scores []models.AnomalyScore
	offset := (page - 1) * pageSize
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&scores).Error; err != nil {
		return nil, 0, err
	}

	// Unmarshal flags JSON into the transient slice.
	for i := range scores {
		_ = json.Unmarshal([]byte(scores[i].FlagsJSON), &scores[i].Flags)
	}

	return scores, total, nil
}

// IsCritical returns true when a score should cause the trade to be blocked.
func IsCritical(score *models.AnomalyScore) bool {
	return score != nil && score.Score >= 76
}

// AnomalyAlertMessage formats a human-readable alert for Telegram.
func AnomalyAlertMessage(score *models.AnomalyScore, input AnomalyInput) string {
	riskEmoji := map[string]string{
		"critical": "🚨",
		"high":     "⚠️",
		"medium":   "🔶",
	}
	emoji := riskEmoji[score.RiskLevel]
	if emoji == "" {
		emoji = "ℹ️"
	}

	blocked := ""
	if score.Blocked {
		blocked = " — *TRADE BLOCKED*"
	}

	flagLines := ""
	for _, f := range score.Flags {
		flagLines += fmt.Sprintf("• %s\n", f)
	}
	if flagLines == "" {
		flagLines = "• (no specific flags)\n"
	}

	return fmt.Sprintf(
		`%s *ANOMALY ALERT* — Risk: %s (score: %d)%s

Trade: %s %s @ $%.2f
Amount: $%s USD

Flags:
%s
Ad: %s
User: %s`,
		emoji,
		score.RiskLevel,
		score.Score,
		blocked,
		input.AdType,
		input.CryptoAsset,
		func() float64 { f, _ := input.Price.Float64(); return f }(),
		input.AmountUSD.StringFixed(2),
		flagLines,
		input.AdID.String()[:8],
		input.TakerID.String()[:8],
	)
}
