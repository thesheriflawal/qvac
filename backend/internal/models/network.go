package models

// Network represents a blockchain network/environment (e.g. Ethereum mainnet, BSC testnet).
type Network struct {
	BaseModel
	Name        string `gorm:"not null" json:"name"`
	ChainKey    string `gorm:"uniqueIndex:idx_chainkey_networktype;not null" json:"chain_key"`
	NetworkType string `gorm:"uniqueIndex:idx_chainkey_networktype;not null" json:"network_type"` // mainnet | testnet
	ChainID     int64  `gorm:"not null" json:"chain_id"`
	IsActive    bool   `gorm:"default:true" json:"is_active"`
}

func (Network) TableName() string {
	return "networks"
}
