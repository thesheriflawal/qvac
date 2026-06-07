package models

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// AnomalyScore records the fraud/anomaly risk score calculated for a P2P trade
// attempt. It is written before execution so high-risk trades can be blocked
// or flagged, and persisted for audit / admin review.
type AnomalyScore struct {
	BaseModel
	// UserID is the taker (the user executing the trade, not the ad owner).
	UserID    uuid.UUID `gorm:"type:uuid;index;not null"           json:"user_id"`
	AdID      uuid.UUID `gorm:"type:uuid;index;not null"           json:"ad_id"`
	// OrderID is populated after the order is created (may be nil if blocked).
	OrderID   *uuid.UUID `gorm:"type:uuid;index"                   json:"order_id,omitempty"`
	Score     int        `gorm:"not null;default:0"                 json:"score"`      // 0-100
	RiskLevel string     `gorm:"type:varchar(20);not null"          json:"risk_level"` // low, medium, high, critical
	FlagsJSON string     `gorm:"type:text"                          json:"-"`          // JSON array of triggered rule names
	Flags     []string   `gorm:"-"                                  json:"flags"`
	// AmountUSD is the trade size (stored for quick aggregation in admin views).
	AmountUSD decimal.Decimal `gorm:"type:decimal(20,8);default:0"  json:"amount_usd"`
	Blocked   bool     `gorm:"default:false"                      json:"blocked"`
}

// TableName sets the GORM table name.
func (AnomalyScore) TableName() string { return "anomaly_scores" }

// RiskLevelFromScore maps a 0-100 score to a named risk level.
func RiskLevelFromScore(score int) string {
	switch {
	case score >= 76:
		return "critical"
	case score >= 51:
		return "high"
	case score >= 26:
		return "medium"
	default:
		return "low"
	}
}
