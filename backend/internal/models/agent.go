package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Agent represents an AI trading agent owned by a user. Each agent has a
// strategy configuration and tracks performance metrics across all decision cycles.
// Inference runs locally on the user's device via the QVAC SDK.
type Agent struct {
	BaseModel
	UserID         uuid.UUID       `gorm:"type:uuid;index;not null"          json:"user_id"`
	Name           string          `gorm:"type:varchar(100);not null"         json:"name"`
	Description    string          `gorm:"type:text"                          json:"description,omitempty"`
	StrategyJSON   string          `gorm:"type:text;not null"                 json:"-"`
	Status         string          `gorm:"type:varchar(20);default:'active'"  json:"status"` // active, paused, terminated
	TotalDecisions int64           `gorm:"default:0"                          json:"total_decisions"`
	TotalExecuted  int64           `gorm:"default:0"                          json:"total_executed"`
	WinCount       int64           `gorm:"default:0"                          json:"win_count"`
	ProfitLossUSD  decimal.Decimal `gorm:"type:decimal(20,8);default:0"       json:"profit_loss_usd"`
	TotalVolumeUSD decimal.Decimal `gorm:"type:decimal(20,8);default:0"       json:"total_volume_usd"`
	LastCycleAt    *time.Time      `gorm:""                                   json:"last_cycle_at,omitempty"`
}

// TableName sets the GORM table name.
func (Agent) TableName() string { return "agents" }

// AgentDecision records a single decision submitted by the client-side QVAC agent
// during one inference cycle. Every decision is persisted regardless of whether
// it is executed, creating an auditable performance log.
type AgentDecision struct {
	BaseModel
	AgentID     uuid.UUID       `gorm:"type:uuid;index;not null"          json:"agent_id"`
	Action      string          `gorm:"type:varchar(10);not null"          json:"action"`     // buy, sell, hold
	Asset       string          `gorm:"type:varchar(20)"                   json:"asset"`      // e.g. BTC, ETH, USDT
	AmountUSD   decimal.Decimal `gorm:"type:decimal(20,8);default:0"       json:"amount_usd"` // size of trade in USD
	Price       decimal.Decimal `gorm:"type:decimal(20,8);default:0"       json:"price"`      // asset price at decision time
	Reasoning   string          `gorm:"type:text"                          json:"reasoning"`  // QVAC model explanation
	ContextJSON string          `gorm:"type:text"                          json:"-"`          // market snapshot used for inference
	Status      string          `gorm:"type:varchar(20);default:'pending'" json:"status"`    // pending, executed, skipped, failed
	PnLUSD      decimal.Decimal `gorm:"type:decimal(20,8);default:0"       json:"pnl_usd"`
}

// TableName sets the GORM table name.
func (AgentDecision) TableName() string { return "agent_decisions" }

// AgentStrategyConfig is the structured form of Agent.StrategyJSON.
type AgentStrategyConfig struct {
	RiskLevel    string   `json:"risk_level"`    // conservative, moderate, aggressive
	MaxSpendUSD  float64  `json:"max_spend_usd"` // max per-trade size in USD
	TargetAssets []string `json:"target_assets"` // e.g. ["BTC","ETH","USDT"]
	AutoExecute  bool     `json:"auto_execute"`  // whether to automatically record as executed
	CycleSeconds int      `json:"cycle_seconds"` // how often client should run inference (default 60)
}
