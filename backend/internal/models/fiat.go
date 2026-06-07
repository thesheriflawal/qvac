package models

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// FiatDeposit represents a fiat deposit (bank transfer)
type FiatDeposit struct {
	BaseModel
	UserID        uuid.UUID       `gorm:"type:uuid;index;not null" json:"user_id"`
	Amount        decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"amount"`
	BankName      string          `json:"bank_name"`
	AccountNumber string          `json:"account_number"`
	Reference     string          `gorm:"uniqueIndex;not null" json:"reference"`
	Status        string          `gorm:"default:'pending'" json:"status"` // pending, confirmed
}

// TableName specifies the table name for FiatDeposit model
func (FiatDeposit) TableName() string {
	return "fiat_deposits"
}

// FiatWithdrawal represents a fiat withdrawal
type FiatWithdrawal struct {
	BaseModel
	UserID        uuid.UUID       `gorm:"type:uuid;index;not null" json:"user_id"`
	Amount        decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"amount"`
	Fee           decimal.Decimal `gorm:"type:decimal(20,8);not null;default:0" json:"fee"`
	StampDuty     decimal.Decimal `gorm:"type:decimal(20,8);not null;default:0" json:"stamp_duty"`
	TotalFee      decimal.Decimal `gorm:"type:decimal(20,8);not null;default:0" json:"total_fee"`
	BankName      string          `json:"bank_name"`
	AccountNumber string          `json:"account_number"`
	Status        string          `gorm:"default:'processing'" json:"status"` // processing, completed, failed
}

// TableName specifies the table name for FiatWithdrawal model
func (FiatWithdrawal) TableName() string {
	return "fiat_withdrawals"
}

// BankAccount represents a user's bank account
type BankAccount struct {
	BaseModel
	UserID        uuid.UUID `gorm:"type:uuid;index;not null" json:"user_id"`
	BankName      string `gorm:"not null" json:"bank_name"`
	AccountNumber string `gorm:"not null" json:"account_number"`
	AccountName   string `gorm:"not null" json:"account_name"`
}

// TableName specifies the table name for BankAccount model
func (BankAccount) TableName() string {
	return "bank_accounts"
}
