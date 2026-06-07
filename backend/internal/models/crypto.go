package models

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// CryptoDeposit represents a crypto deposit
type CryptoDeposit struct {
	BaseModel
	UserID   uuid.UUID       `gorm:"type:uuid;index;not null" json:"user_id"`
	Currency string          `gorm:"not null" json:"currency"`
	Network  string          `json:"network"`
	TxHash   string          `gorm:"uniqueIndex;not null" json:"tx_hash"`
	Amount   decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"amount"`
	Status   string          `gorm:"default:'pending'" json:"status"` // pending, confirmed
}

// TableName specifies the table name for CryptoDeposit model
func (CryptoDeposit) TableName() string {
	return "crypto_deposits"
}

// CryptoWithdrawal represents a crypto withdrawal
type CryptoWithdrawal struct {
	BaseModel
	UserID   uuid.UUID       `gorm:"type:uuid;index;not null" json:"user_id"`
	Currency string          `gorm:"not null" json:"currency"`
	Address  string          `gorm:"not null" json:"address"`
	Amount   decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"amount"`
	Fee      decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"fee"`
	Status   string          `gorm:"default:'processing'" json:"status"` // processing, completed, failed
	TxHash   string          `gorm:"type:varchar(255)" json:"tx_hash,omitempty"`
}

// TableName specifies the table name for CryptoWithdrawal model
func (CryptoWithdrawal) TableName() string {
	return "crypto_withdrawals"
}

// CryptoAddress represents a user's on-chain address for a specific network + currency.
//
// We store foreign keys into reference tables so supported networks/currencies are centrally managed.
// Uniqueness is (user_id, network_id, currency_id).
type CryptoAddress struct {
	BaseModel

	UserID uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_user_network_currency;not null" json:"user_id"`

	NetworkID uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_user_network_currency;not null" json:"network_id"`
	Network   Network   `gorm:"foreignKey:NetworkID" json:"-"`

	CurrencyID uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_user_network_currency;not null" json:"currency_id"`
	Currency   Currency  `gorm:"foreignKey:CurrencyID" json:"-"`

	Address        string  `gorm:"not null" json:"address"`
	DestinationTag *string `gorm:"default:null" json:"destination_tag"`
}

// TableName specifies the table name for CryptoAddress model
func (CryptoAddress) TableName() string {
	return "crypto_addresses"
}
