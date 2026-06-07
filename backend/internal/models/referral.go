package models

import (
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Referral status constants
const (
	ReferralStatusPending   = "pending"
	ReferralStatusCompleted = "completed"
)

// Claim cycle status constants
const (
	ClaimCycleStatusOpen   = "open"
	ClaimCycleStatusClosed = "closed"
)

// Referral config key constants
const (
	ReferralConfigPointsPerUSD          = "points_per_usd"
	ReferralConfigMinTradesEligibility  = "min_trades_for_eligibility"
)

// Referral represents a referral relationship between two users.
type Referral struct {
	BaseModel
	ReferrerID uuid.UUID  `gorm:"type:uuid;index;not null" json:"referrer_id"`
	RefereeID  uuid.UUID  `gorm:"type:uuid;uniqueIndex;not null" json:"referee_id"`
	Status     string     `gorm:"type:varchar(20);default:'pending';not null" json:"status"`
	RewardedAt *time.Time `json:"rewarded_at,omitempty"`

	// Relations
	Referrer *User `gorm:"foreignKey:ReferrerID" json:"referrer,omitempty"`
	Referee  *User `gorm:"foreignKey:RefereeID" json:"referee,omitempty"`
}

// TableName specifies the table name for Referral model.
func (Referral) TableName() string {
	return "referrals"
}

// ReferralPointBalance holds the lifetime points balance for a referrer.
type ReferralPointBalance struct {
	BaseModel
	UserID      uuid.UUID       `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	TotalPoints decimal.Decimal `gorm:"type:decimal(20,4);default:0;not null" json:"total_points"`
}

// TableName specifies the table name for ReferralPointBalance model.
func (ReferralPointBalance) TableName() string {
	return "referral_point_balances"
}

// ReferralPointTransaction records an individual point accrual from a referee's P2P order.
type ReferralPointTransaction struct {
	BaseModel
	ReferrerID  uuid.UUID       `gorm:"type:uuid;index;not null" json:"referrer_id"`
	RefereeID   uuid.UUID       `gorm:"type:uuid;index;not null" json:"referee_id"`
	ReferralID  uuid.UUID       `gorm:"type:uuid;index;not null" json:"referral_id"`
	P2POrderID  uuid.UUID       `gorm:"type:uuid;index;not null" json:"p2p_order_id"`
	VolumeUSD   decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"volume_usd"`
	PointsEarned decimal.Decimal `gorm:"type:decimal(20,4);not null" json:"points_earned"`
	Description string          `gorm:"type:text" json:"description"`
}

// TableName specifies the table name for ReferralPointTransaction model.
func (ReferralPointTransaction) TableName() string {
	return "referral_point_transactions"
}

// ReferralConfig holds admin-managed referral settings.
type ReferralConfig struct {
	BaseModel
	Key         string `gorm:"type:varchar(100);uniqueIndex;not null" json:"key"`
	Value       string `gorm:"type:varchar(255);not null" json:"value"`
	Description string `gorm:"type:text" json:"description"`
}

// TableName specifies the table name for ReferralConfig model.
func (ReferralConfig) TableName() string {
	return "referral_configs"
}

// ReferralClaimCycle represents an admin-approved claim window for a quarter.
type ReferralClaimCycle struct {
	BaseModel
	Quarter            string          `gorm:"type:varchar(10);uniqueIndex;not null" json:"quarter"` // e.g. "2026-Q1"
	PoolAmountFiat     decimal.Decimal `gorm:"type:decimal(20,4);not null" json:"pool_amount_fiat"`
	Currency           string          `gorm:"type:varchar(10);not null" json:"currency"` // e.g. "NGN"
	TotalPointsInCycle decimal.Decimal `gorm:"type:decimal(20,4);not null" json:"total_points_in_cycle"`
	FiatPerPoint       decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"fiat_per_point"`
	Status             string          `gorm:"type:varchar(20);default:'open';not null" json:"status"`
	OpenedAt           *time.Time      `json:"opened_at,omitempty"`
	ClosedAt           *time.Time      `json:"closed_at,omitempty"`
}

// TableName specifies the table name for ReferralClaimCycle model.
func (ReferralClaimCycle) TableName() string {
	return "referral_claim_cycles"
}

// ReferralClaim records an individual user's claim for a cycle.
type ReferralClaim struct {
	BaseModel
	UserID       uuid.UUID       `gorm:"type:uuid;uniqueIndex:idx_user_cycle;not null" json:"user_id"`
	ClaimCycleID uuid.UUID       `gorm:"type:uuid;uniqueIndex:idx_user_cycle;not null" json:"claim_cycle_id"`
	PointsClaimed decimal.Decimal `gorm:"type:decimal(20,4);not null" json:"points_claimed"`
	FiatAmount   decimal.Decimal `gorm:"type:decimal(20,4);not null" json:"fiat_amount"`
	Currency     string          `gorm:"type:varchar(10);not null" json:"currency"`
	ClaimedAt    time.Time       `gorm:"not null" json:"claimed_at"`

	// Relations
	ClaimCycle *ReferralClaimCycle `gorm:"foreignKey:ClaimCycleID" json:"claim_cycle,omitempty"`
}

// TableName specifies the table name for ReferralClaim model.
func (ReferralClaim) TableName() string {
	return "referral_claims"
}

// ReferralClaimCycleResponse represents the claim cycle data for API responses.
type ReferralClaimCycleResponse struct {
	ID                 uuid.UUID       `json:"id"`
	Quarter            string          `json:"quarter"`
	PoolAmountFiat     decimal.Decimal `json:"pool_amount_fiat"`
	Currency           string          `json:"currency"`
	TotalPointsInCycle decimal.Decimal `json:"total_points_in_cycle"`
	FiatPerPoint       decimal.Decimal `json:"fiat_per_point"`
	Status             string          `json:"status"`
	OpenedAt           *time.Time      `json:"opened_at,omitempty"`
	ClosedAt           *time.Time      `json:"closed_at,omitempty"`
	CreatedAt          string          `json:"created_at"`
}

// ToResponse converts ReferralClaimCycle to its API response.
func (c *ReferralClaimCycle) ToResponse() *ReferralClaimCycleResponse {
	return &ReferralClaimCycleResponse{
		ID:                 c.ID,
		Quarter:            c.Quarter,
		PoolAmountFiat:     utils.TruncateIfFiat(c.PoolAmountFiat, c.Currency),
		Currency:           c.Currency,
		TotalPointsInCycle: c.TotalPointsInCycle,
		FiatPerPoint:       utils.TruncateIfFiat(c.FiatPerPoint, c.Currency),
		Status:             c.Status,
		OpenedAt:           c.OpenedAt,
		ClosedAt:           c.ClosedAt,
		CreatedAt:          c.CreatedAt.Format(time.RFC3339),
	}
}

// ReferralClaimResponse represents a claim record for API responses.
type ReferralClaimResponse struct {
	ID            uuid.UUID       `json:"id"`
	PointsClaimed decimal.Decimal `json:"points_claimed"`
	FiatAmount    decimal.Decimal `json:"fiat_amount"`
	Currency      string          `json:"currency"`
	Quarter       string          `json:"quarter"`
	ClaimedAt     string          `json:"claimed_at"`
}
