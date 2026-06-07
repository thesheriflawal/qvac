package models

import (
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Wallet represents a user's wallet. Balances are stored as smallest-unit
// integers (e.g. kobo for NGN, satoshi for BTC) determined by
// Currency.Decimals. Use WalletResponse for API output.
type Wallet struct {
	BaseModel
	UserID        uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_user_currency;not null" json:"user_id"`
	CurrencyID    uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_user_currency;not null" json:"currency_id"`
	Currency      string    `gorm:"not null" json:"currency"`
	Balance       int64     `gorm:"type:bigint;default:0" json:"balance"`
	LockedBalance int64     `gorm:"type:bigint;default:0" json:"locked_balance"`

	// Optional relation to the reference currency (preload to enable ToResponse).
	CurrencyRef *Currency `gorm:"foreignKey:CurrencyID" json:"-"`
}

// TableName specifies the table name for Wallet model
func (Wallet) TableName() string {
	return "wallets"
}

// WalletResponse is the human-readable API representation of a wallet.
// Balance and LockedBalance are expressed in the currency's standard unit
// (e.g. NGN, not kobo).
type WalletResponse struct {
	ID            uuid.UUID       `json:"id"`
	UserID        uuid.UUID       `json:"user_id"`
	CurrencyID    uuid.UUID       `json:"currency_id"`
	Currency      string          `json:"currency"`
	Balance       decimal.Decimal `json:"balance"`
	LockedBalance decimal.Decimal `json:"locked_balance"`
	CreatedAt     string          `json:"created_at"`
	UpdatedAt     string          `json:"updated_at"`
}

// ToResponse converts storage-unit balances to human-readable decimal amounts.
// Requires CurrencyRef to be preloaded; falls back to 8 decimal places if not.
func (w *Wallet) ToResponse() WalletResponse {
	decimals := 8
	if w.CurrencyRef != nil {
		decimals = w.CurrencyRef.Decimals
	}
	return WalletResponse{
		ID:            w.ID,
		UserID:        w.UserID,
		CurrencyID:    w.CurrencyID,
		Currency:      w.Currency,
		Balance:       utils.FromStorageUnits(w.Balance, decimals),
		LockedBalance: utils.FromStorageUnits(w.LockedBalance, decimals),
		CreatedAt:     w.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     w.UpdatedAt.Format(time.RFC3339),
	}
}

// WalletTransaction represents a transaction in a wallet.
// Amount, BalanceBefore, and BalanceAfter are stored in human-readable decimal
// form (not storage units) for display and audit purposes.
type WalletTransaction struct {
	BaseModel
	WalletID        uuid.UUID       `gorm:"type:uuid;index;not null" json:"wallet_id"`
	Type            string          `gorm:"not null" json:"type"` // deposit, withdrawal, trade, fee, escrow_lock
	Amount          decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"amount"`
	BalanceBefore   decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"balance_before"`
	BalanceAfter    decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"balance_after"`
	ReferenceID     string          `json:"reference_id"`
	Description     string          `json:"description"`
	CryptoDepositID    *uuid.UUID        `gorm:"type:uuid;index" json:"crypto_deposit_id,omitempty"`
	CryptoDeposit      *CryptoDeposit    `gorm:"foreignKey:CryptoDepositID" json:"crypto_deposit,omitempty"`
	CryptoWithdrawalID *uuid.UUID        `gorm:"type:uuid;index" json:"crypto_withdrawal_id,omitempty"`
	CryptoWithdrawal   *CryptoWithdrawal `gorm:"foreignKey:CryptoWithdrawalID" json:"crypto_withdrawal,omitempty"`
	FiatDepositID      *uuid.UUID        `gorm:"type:uuid;index" json:"fiat_deposit_id,omitempty"`
	FiatDeposit        *FiatDeposit      `gorm:"foreignKey:FiatDepositID" json:"fiat_deposit,omitempty"`
	FiatWithdrawalID   *uuid.UUID        `gorm:"type:uuid;index" json:"fiat_withdrawal_id,omitempty"`
	FiatWithdrawal     *FiatWithdrawal   `gorm:"foreignKey:FiatWithdrawalID" json:"fiat_withdrawal,omitempty"`

	// Currency is not stored in this table; it is populated from the parent
	// wallet at query time via a JOIN.
	Currency string `gorm:"-:migration;<-:false" json:"currency,omitempty"`
}

// TableName specifies the table name for WalletTransaction model
func (WalletTransaction) TableName() string {
	return "wallet_transactions"
}
