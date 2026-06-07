package models

import (
	"time"

	"github.com/google/uuid"
)

// UserSecurity represents security settings for a user
type UserSecurity struct {
	BaseModel
	UserID               uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	PinHash              string    `json:"-"`
	PinEnabled           bool      `gorm:"default:false" json:"pin_enabled"`
	TwoFAEnabled         bool      `gorm:"default:false" json:"twofa_enabled"`
	TwoFASecret          string    `json:"-"`
	NotificationsEnabled bool      `gorm:"default:true" json:"notifications_enabled"`
	LastPinChange        time.Time `json:"last_pin_change"`
}

// TableName specifies the table name for UserSecurity model
func (UserSecurity) TableName() string {
	return "user_security"
}
