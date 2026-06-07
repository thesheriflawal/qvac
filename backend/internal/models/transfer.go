package models

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// InternalTransfer represents an internal transfer between users
type InternalTransfer struct {
	BaseModel
	SenderID   uuid.UUID       `gorm:"type:uuid;index;not null" json:"sender_id"`
	ReceiverID uuid.UUID       `gorm:"type:uuid;index;not null" json:"receiver_id"`
	Currency   string          `gorm:"not null" json:"currency"`
	Amount     decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"amount"`
	Status     string          `gorm:"default:'completed'" json:"status"`
}

// TableName specifies the table name for InternalTransfer model
func (InternalTransfer) TableName() string {
	return "internal_transfers"
}
