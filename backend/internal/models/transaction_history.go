package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// TransactionHistoryItem is the enriched response returned by the wallet
// transactions endpoint. It resolves the underlying source record (internal
// transfer, crypto deposit/withdrawal, fiat deposit/withdrawal, P2P trade,
// etc.) so the client gets status, counterparty, fees, and type-specific
// details in a single payload.
type TransactionHistoryItem struct {
	ID            uuid.UUID       `json:"id"`
	Type          string          `json:"type"`
	Amount        decimal.Decimal `json:"amount"`
	Currency      string          `json:"currency"`
	Status        string          `json:"status"`
	Method        string          `json:"method"` // "bank_transfer", "internal_transfer", "onchain", "p2p_trade", "referral_reward"
	Fee           decimal.Decimal `json:"fee"`
	BalanceBefore decimal.Decimal `json:"balance_before"`
	BalanceAfter  decimal.Decimal `json:"balance_after"`
	Description   string          `json:"description"`
	CreatedAt     time.Time       `json:"created_at"`

	// Counterparty (sender or receiver, if applicable).
	Counterparty *CounterpartyInfo `json:"counterparty,omitempty"`

	// Receipt holds type-specific details (bank info for fiat, chain info for
	// crypto). It is always present so the client can access receipt fields
	// without checking a separate level.
	Receipt TransactionReceipt `json:"receipt"`
}

// TransactionReceipt contains the type-specific details for a transaction.
// Fields are omitted when not applicable to the transaction type.
type TransactionReceipt struct {
	// Fiat-specific fields.
	BankName      string `json:"bank_name,omitempty"`
	AccountNumber string `json:"account_number,omitempty"`

	// Crypto-specific fields.
	Address string `json:"address,omitempty"`
	TxHash  string `json:"tx_hash,omitempty"`
	Network string `json:"network,omitempty"`
}

// CounterpartyInfo exposes safe, non-internal identifiers for the other party
// in a transfer.
type CounterpartyInfo struct {
	Name  string `json:"name,omitempty"`
	UID   string `json:"uid,omitempty"`
	Email string `json:"email,omitempty"`
}
