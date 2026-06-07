package models

import "github.com/google/uuid"

// CurrencyNetwork maps a currency to a supported blockchain network.
// For example, USDT is available on ERC20, TRC20, BEP20, etc.
type CurrencyNetwork struct {
	BaseModel
	CurrencyID uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_currency_network;not null" json:"currency_id"`
	Currency   Currency  `gorm:"foreignKey:CurrencyID" json:"-"`
	NetworkID  uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_currency_network;not null" json:"network_id"`
	Network    Network   `gorm:"foreignKey:NetworkID" json:"network"`
}

func (CurrencyNetwork) TableName() string {
	return "currency_networks"
}
