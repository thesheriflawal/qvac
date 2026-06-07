package models

import "github.com/google/uuid"

// WithdrawalLimitOverride stores a permanent, admin-set daily NGN withdrawal
// limit for a specific user that overrides the tier-based default. The record
// is deleted (not soft-deleted) when the override is removed.
type WithdrawalLimitOverride struct {
	BaseModel
	UserID   uuid.UUID `gorm:"not null;uniqueIndex" json:"user_id"`
	LimitNGN int64     `gorm:"not null"            json:"limit_ngn"` // in Naira
	SetByID  uuid.UUID `gorm:"not null"            json:"set_by_id"` // admin user UUID
}
