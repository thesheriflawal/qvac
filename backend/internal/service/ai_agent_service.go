package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// AIAgentService manages AI trading agents and stores decisions submitted by
// client-side QVAC inference.
type AIAgentService interface {
	// CreateAgent creates a new agent for the given user.
	CreateAgent(ctx context.Context, userID uuid.UUID, input CreateAgentInput) (*models.Agent, error)

	// GetAgent returns an agent by ID, validating ownership.
	GetAgent(ctx context.Context, userID, agentID uuid.UUID) (*models.Agent, error)

	// ListAgents returns all agents for a user.
	ListAgents(ctx context.Context, userID uuid.UUID) ([]models.Agent, error)

	// UpdateAgentStatus pauses, resumes, or terminates an agent.
	UpdateAgentStatus(ctx context.Context, userID, agentID uuid.UUID, status string) (*models.Agent, error)

	// GetMarketContext returns the current market data snapshot for a QVAC inference cycle.
	GetMarketContext(ctx context.Context, userID, agentID uuid.UUID) (*MarketContextResponse, error)

	// SubmitDecision stores a decision produced by the client-side QVAC model.
	SubmitDecision(ctx context.Context, userID, agentID uuid.UUID, input SubmitDecisionInput) (*models.AgentDecision, error)

	// ListDecisions returns paginated decision history for an agent.
	ListDecisions(ctx context.Context, userID, agentID uuid.UUID, page, pageSize int) ([]models.AgentDecision, int64, error)

	// GetPerformanceSummary returns aggregate metrics for an agent.
	GetPerformanceSummary(ctx context.Context, userID, agentID uuid.UUID) (*AgentPerformanceSummary, error)
}

// CreateAgentInput holds the fields required to create a new agent.
type CreateAgentInput struct {
	Name         string
	Description  string
	RiskLevel    string   // conservative, moderate, aggressive
	MaxSpendUSD  float64  // per-trade max
	TargetAssets []string // e.g. ["BTC","ETH","USDT"]
	AutoExecute  bool
	CycleSeconds int
}

// SubmitDecisionInput is sent by the frontend after running QVAC inference.
type SubmitDecisionInput struct {
	Action      string  `json:"action"`       // buy, sell, hold
	Asset       string  `json:"asset"`        // e.g. BTC, ETH
	AmountUSD   float64 `json:"amount_usd"`
	Reasoning   string  `json:"reasoning"`    // explanation from the local model
	ContextJSON string  `json:"context_json"` // market snapshot used (optional audit trail)
}

// MarketContextResponse is returned to the client before it runs QVAC inference.
type MarketContextResponse struct {
	AgentID       uuid.UUID              `json:"agent_id"`
	AgentName     string                 `json:"agent_name"`
	Strategy      models.AgentStrategyConfig `json:"strategy"`
	Timestamp     string                 `json:"timestamp"`
	PricesUSD     map[string]float64     `json:"prices_usd"`
	RecentTrades  []recentTrade          `json:"recent_trades"`
	PnLUSD        float64                `json:"pnl_usd"`
	VolumeUSD     float64                `json:"volume_usd"`
	TotalExecuted int64                  `json:"total_executed"`
}

// AgentPerformanceSummary is the response shape for agent performance metrics.
type AgentPerformanceSummary struct {
	AgentID        uuid.UUID       `json:"agent_id"`
	Name           string          `json:"name"`
	Status         string          `json:"status"`
	TotalDecisions int64           `json:"total_decisions"`
	TotalExecuted  int64           `json:"total_executed"`
	WinRate        string          `json:"win_rate"`
	ProfitLossUSD  decimal.Decimal `json:"profit_loss_usd"`
	TotalVolumeUSD decimal.Decimal `json:"total_volume_usd"`
	LastCycleAt    *time.Time      `json:"last_cycle_at,omitempty"`
}

type recentTrade struct {
	Action string  `json:"action"`
	Asset  string  `json:"asset"`
	Amount float64 `json:"amount_usd"`
	PnL    float64 `json:"pnl_usd"`
}

type aiAgentService struct {
	priceService PriceService
}

// NewAIAgentService constructs the AI agent service.
func NewAIAgentService(priceService PriceService) AIAgentService {
	return &aiAgentService{priceService: priceService}
}

func (s *aiAgentService) CreateAgent(ctx context.Context, userID uuid.UUID, input CreateAgentInput) (*models.Agent, error) {
	if userID == uuid.Nil {
		return nil, fmt.Errorf("invalid user")
	}
	if strings.TrimSpace(input.Name) == "" {
		return nil, fmt.Errorf("agent name is required")
	}

	riskLevel := strings.ToLower(strings.TrimSpace(input.RiskLevel))
	if riskLevel != "conservative" && riskLevel != "moderate" && riskLevel != "aggressive" {
		riskLevel = "moderate"
	}
	if input.MaxSpendUSD <= 0 {
		input.MaxSpendUSD = 100
	}
	if len(input.TargetAssets) == 0 {
		input.TargetAssets = []string{"BTC", "ETH", "USDT"}
	}
	if input.CycleSeconds <= 0 {
		input.CycleSeconds = 60
	}

	strategy := models.AgentStrategyConfig{
		RiskLevel:    riskLevel,
		MaxSpendUSD:  input.MaxSpendUSD,
		TargetAssets: input.TargetAssets,
		AutoExecute:  input.AutoExecute,
		CycleSeconds: input.CycleSeconds,
	}
	stratJSON, err := json.Marshal(strategy)
	if err != nil {
		return nil, fmt.Errorf("failed to encode strategy: %w", err)
	}

	agent := &models.Agent{
		UserID:       userID,
		Name:         strings.TrimSpace(input.Name),
		Description:  strings.TrimSpace(input.Description),
		StrategyJSON: string(stratJSON),
		Status:       "active",
	}

	if err := database.GetDB().WithContext(ctx).Create(agent).Error; err != nil {
		return nil, fmt.Errorf("failed to create agent: %w", err)
	}

	logger.FromCtx(ctx).Info("AI agent created",
		zap.String("agent_id", agent.ID.String()),
		zap.String("user_id", userID.String()),
		zap.String("name", agent.Name),
	)

	return agent, nil
}

func (s *aiAgentService) GetAgent(ctx context.Context, userID, agentID uuid.UUID) (*models.Agent, error) {
	var agent models.Agent
	if err := database.GetDB().WithContext(ctx).
		Where("id = ? AND user_id = ?", agentID, userID).
		First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("agent not found")
		}
		return nil, err
	}
	return &agent, nil
}

func (s *aiAgentService) ListAgents(ctx context.Context, userID uuid.UUID) ([]models.Agent, error) {
	var agents []models.Agent
	if err := database.GetDB().WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&agents).Error; err != nil {
		return nil, err
	}
	return agents, nil
}

func (s *aiAgentService) UpdateAgentStatus(ctx context.Context, userID, agentID uuid.UUID, status string) (*models.Agent, error) {
	status = strings.ToLower(strings.TrimSpace(status))
	if status != "active" && status != "paused" && status != "terminated" {
		return nil, fmt.Errorf("invalid status: must be active, paused, or terminated")
	}

	var agent models.Agent
	if err := database.GetDB().WithContext(ctx).
		Where("id = ? AND user_id = ?", agentID, userID).
		First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("agent not found")
		}
		return nil, err
	}
	if agent.Status == "terminated" {
		return nil, fmt.Errorf("terminated agents cannot be restarted")
	}

	agent.Status = status
	if err := database.GetDB().WithContext(ctx).Save(&agent).Error; err != nil {
		return nil, err
	}
	return &agent, nil
}

// GetMarketContext assembles the data snapshot that the frontend QVAC model needs
// to make a decision. The client fetches this, runs local inference, then submits
// the result via SubmitDecision.
func (s *aiAgentService) GetMarketContext(ctx context.Context, userID, agentID uuid.UUID) (*MarketContextResponse, error) {
	var agent models.Agent
	if err := database.GetDB().WithContext(ctx).
		Where("id = ? AND user_id = ?", agentID, userID).
		First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("agent not found")
		}
		return nil, err
	}
	if agent.Status != "active" {
		return nil, fmt.Errorf("agent is not active (status: %s)", agent.Status)
	}

	var strategy models.AgentStrategyConfig
	if err := json.Unmarshal([]byte(agent.StrategyJSON), &strategy); err != nil {
		return nil, fmt.Errorf("invalid agent strategy: %w", err)
	}

	// Fetch live prices for the agent's target assets.
	prices := make(map[string]float64)
	for asset, geckoID := range assetsToCoinGeckoIDs(strategy.TargetAssets) {
		if price, err := s.priceService.GetMarketPrice(ctx, geckoID, "usd"); err == nil {
			f, _ := price.Float64()
			prices[asset] = f
		}
	}

	// Fetch last 5 executed decisions for context.
	var recentDecisions []models.AgentDecision
	database.GetDB().WithContext(ctx).
		Where("agent_id = ? AND status = 'executed'", agentID).
		Order("created_at DESC").
		Limit(5).
		Find(&recentDecisions)

	recentTrades := make([]recentTrade, 0, len(recentDecisions))
	for _, d := range recentDecisions {
		amt, _ := d.AmountUSD.Float64()
		pnl, _ := d.PnLUSD.Float64()
		recentTrades = append(recentTrades, recentTrade{
			Action: d.Action,
			Asset:  d.Asset,
			Amount: amt,
			PnL:    pnl,
		})
	}

	pnl, _ := agent.ProfitLossUSD.Float64()
	vol, _ := agent.TotalVolumeUSD.Float64()

	return &MarketContextResponse{
		AgentID:       agent.ID,
		AgentName:     agent.Name,
		Strategy:      strategy,
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		PricesUSD:     prices,
		RecentTrades:  recentTrades,
		PnLUSD:        pnl,
		VolumeUSD:     vol,
		TotalExecuted: agent.TotalExecuted,
	}, nil
}

// SubmitDecision stores a decision produced by the client-side QVAC model and
// updates the agent's performance counters.
func (s *aiAgentService) SubmitDecision(ctx context.Context, userID, agentID uuid.UUID, input SubmitDecisionInput) (*models.AgentDecision, error) {
	var agent models.Agent
	if err := database.GetDB().WithContext(ctx).
		Where("id = ? AND user_id = ?", agentID, userID).
		First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("agent not found")
		}
		return nil, err
	}
	if agent.Status != "active" {
		return nil, fmt.Errorf("agent is not active (status: %s)", agent.Status)
	}

	var strategy models.AgentStrategyConfig
	if err := json.Unmarshal([]byte(agent.StrategyJSON), &strategy); err != nil {
		return nil, fmt.Errorf("invalid agent strategy: %w", err)
	}

	action := strings.ToLower(strings.TrimSpace(input.Action))
	if action != "buy" && action != "sell" && action != "hold" {
		return nil, fmt.Errorf("invalid action: must be buy, sell, or hold")
	}

	asset := strings.ToUpper(strings.TrimSpace(input.Asset))
	if action != "hold" && asset == "" {
		return nil, fmt.Errorf("asset is required for buy/sell decisions")
	}
	if input.AmountUSD > strategy.MaxSpendUSD {
		input.AmountUSD = strategy.MaxSpendUSD
	}

	status := "skipped"
	if strategy.AutoExecute && action != "hold" {
		status = "executed"
	}

	amount := decimal.NewFromFloat(input.AmountUSD)
	decision := &models.AgentDecision{
		AgentID:     agentID,
		Action:      action,
		Asset:       asset,
		AmountUSD:   amount,
		Reasoning:   input.Reasoning,
		ContextJSON: input.ContextJSON,
		Status:      status,
	}

	if err := database.GetDB().WithContext(ctx).Create(decision).Error; err != nil {
		return nil, fmt.Errorf("failed to save decision: %w", err)
	}

	// Update agent performance counters.
	now := time.Now().UTC()
	updates := map[string]interface{}{
		"total_decisions": gorm.Expr("total_decisions + 1"),
		"last_cycle_at":   now,
	}
	if status == "executed" {
		updates["total_executed"] = gorm.Expr("total_executed + 1")
		updates["total_volume_usd"] = gorm.Expr("total_volume_usd + ?", amount)
	}
	database.GetDB().WithContext(ctx).Model(&models.Agent{}).Where("id = ?", agentID).Updates(updates)

	logger.FromCtx(ctx).Info("QVAC decision submitted",
		zap.String("agent_id", agentID.String()),
		zap.String("action", action),
		zap.String("asset", asset),
		zap.String("status", status),
	)

	return decision, nil
}

func (s *aiAgentService) ListDecisions(ctx context.Context, userID, agentID uuid.UUID, page, pageSize int) ([]models.AgentDecision, int64, error) {
	var agent models.Agent
	if err := database.GetDB().WithContext(ctx).
		Where("id = ? AND user_id = ?", agentID, userID).
		First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, 0, fmt.Errorf("agent not found")
		}
		return nil, 0, err
	}

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var decisions []models.AgentDecision
	var total int64

	db := database.GetDB().WithContext(ctx).Model(&models.AgentDecision{}).Where("agent_id = ?", agentID)
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&decisions).Error; err != nil {
		return nil, 0, err
	}
	return decisions, total, nil
}

func (s *aiAgentService) GetPerformanceSummary(ctx context.Context, userID, agentID uuid.UUID) (*AgentPerformanceSummary, error) {
	var agent models.Agent
	if err := database.GetDB().WithContext(ctx).
		Where("id = ? AND user_id = ?", agentID, userID).
		First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("agent not found")
		}
		return nil, err
	}

	winRate := "0%"
	if agent.TotalExecuted > 0 {
		rate := float64(agent.WinCount) / float64(agent.TotalExecuted) * 100
		winRate = fmt.Sprintf("%.1f%%", rate)
	}

	return &AgentPerformanceSummary{
		AgentID:        agent.ID,
		Name:           agent.Name,
		Status:         agent.Status,
		TotalDecisions: agent.TotalDecisions,
		TotalExecuted:  agent.TotalExecuted,
		WinRate:        winRate,
		ProfitLossUSD:  agent.ProfitLossUSD,
		TotalVolumeUSD: agent.TotalVolumeUSD,
		LastCycleAt:    agent.LastCycleAt,
	}, nil
}

// assetsToCoinGeckoIDs maps common asset symbols to CoinGecko coin IDs.
func assetsToCoinGeckoIDs(assets []string) map[string]string {
	known := map[string]string{
		"BTC":   "bitcoin",
		"ETH":   "ethereum",
		"USDT":  "tether",
		"USDC":  "usd-coin",
		"BNB":   "binancecoin",
		"SOL":   "solana",
		"MATIC": "matic-network",
		"AVAX":  "avalanche-2",
	}
	result := make(map[string]string)
	for _, a := range assets {
		upper := strings.ToUpper(a)
		if id, ok := known[upper]; ok {
			result[upper] = id
		}
	}
	return result
}
