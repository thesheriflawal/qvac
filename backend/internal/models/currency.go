package models

// Currency represents an asset/currency (e.g. USDT, ETH).
type Currency struct {
	BaseModel
	Symbol   string `gorm:"uniqueIndex;not null" json:"symbol"` // ETH, USDT
	Name     string `gorm:"not null" json:"name"`               // Ether, Tether
	Decimals int    `gorm:"not null" json:"decimals"`
	IsNative bool   `gorm:"default:false" json:"is_native"` // true for ETH

	// Type distinguishes fiat currencies (NGN, USD, etc.) from crypto assets.
	// Values: "fiat" or "crypto". Defaults to "crypto" for backward compatibility.
	// Existing fiat currency rows must be updated via a DB migration after deployment.
	Type string `gorm:"type:varchar(10);not null;default:'crypto'" json:"type"`

	// AssetID is the Blockradar asset identifier used for withdrawals (UUID-like string).
	// It is optional because not all currencies need to be withdrawable via Blockradar.
	AssetID string `gorm:"column:asset_id" json:"asset_id,omitempty"`

	// CoinGeckoID is the CoinGecko coin identifier used for price fetching (e.g., "tether", "ethereum").
	// It is optional and only needed for currencies that support relative pricing in P2P ads.
	CoinGeckoID string `gorm:"column:coingecko_id" json:"coingecko_id,omitempty"`
}

func (Currency) TableName() string {
	return "currencies"
}
