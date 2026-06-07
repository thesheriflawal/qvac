package models

import (
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// P2PAd represents a P2P advertisement
//
// Notes:
//   - Type: "sell" ads are for crypto; "buy" ads are for fiat.
//   - MinAmount is the per-order minimum expressed in the ad currency. The maximum is the remaining_quantity.
//   - For non-rollover ads, TotalQuantity is the total capacity of the ad (crypto for sell, fiat for buy),
//     and RemainingQuantity is decremented as orders are filled.
//   - For rollover ads, TotalQuantity/RemainingQuantity are zero and trades use the user's live wallet balance.
type P2PAd struct {
	BaseModel
	UserID            uuid.UUID       `gorm:"type:uuid;index;not null" json:"user_id"`
	Type              string          `gorm:"not null" json:"type"` // buy or sell
	Currency          string          `gorm:"not null" json:"currency"`
	Price             decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"price"`
	PriceType         string          `gorm:"type:varchar(20);not null;default:'fixed'" json:"price_type"` // fixed, relative
	RelativePercent   decimal.Decimal `gorm:"type:decimal(10,4);default:0" json:"relative_percent"`        // +/- % of market price when PriceType=relative
	MinAmount         decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"min_amount"` // per-order minimum
	RolloverEnabled   bool            `gorm:"default:false" json:"rollover_enabled"`
	TotalQuantity     decimal.Decimal `gorm:"type:decimal(20,8);default:0" json:"total_quantity"`     // total ad capacity when rollover is off
	RemainingQuantity decimal.Decimal `gorm:"type:decimal(20,8);default:0" json:"remaining_quantity"` // remaining capacity
	IsPrivate         bool            `gorm:"default:false" json:"is_private"`
	Status            string          `gorm:"default:'active'" json:"status"` // active, paused, closed
	User              *UserProfile    `gorm:"foreignKey:UserID;references:UserID;constraint:-" json:"-"`
	Username          string          `gorm:"-" json:"username,omitempty"`
}

// TableName specifies the table name for P2PAd model
func (P2PAd) TableName() string {
	return "p2p_ads"
}

// P2POrder represents a P2P order
type P2POrder struct {
	BaseModel
	// OrderNumber is a public-facing 20-digit numeric identifier for the order.
	OrderNumber string    `gorm:"type:varchar(20);uniqueIndex;not null" json:"order_number"`
	AdID        uuid.UUID `gorm:"type:uuid;index;not null" json:"ad_id"`
	BuyerID     uuid.UUID `gorm:"type:uuid;index;not null" json:"buyer_id"`
	SellerID    uuid.UUID `gorm:"type:uuid;index;not null" json:"seller_id"`
	// Type indicates whether this is a buy or sell order for crypto (mirrors the ad type).
	Type           string          `gorm:"type:varchar(10);not null" json:"type"` // buy or sell
	Currency       string          `gorm:"not null" json:"currency"`
	Amount         decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"amount"`
	Price          decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"price"`
	Total          decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"total"`
	MakerFeeAmount   decimal.Decimal `gorm:"type:decimal(20,8);default:0" json:"maker_fee_amount"`
	MakerFeeCurrency string          `gorm:"type:varchar(20)" json:"maker_fee_currency"`
	TakerFeeAmount   decimal.Decimal `gorm:"type:decimal(20,8);default:0" json:"taker_fee_amount"`
	TakerFeeCurrency string          `gorm:"type:varchar(20)" json:"taker_fee_currency"`
	EscrowWalletID  *uuid.UUID      `gorm:"type:uuid;index" json:"escrow_wallet_id"`
	Status         string          `gorm:"default:'pending'" json:"status"` // pending, paid, disputed, cancelled, completed
}

// TableName specifies the table name for P2POrder model
func (P2POrder) TableName() string {
	return "p2p_orders"
}

// P2PTradeFee records an individual fee charged to an advertiser on a completed
// P2P trade. This is the primary audit/compliance record.
type P2PTradeFee struct {
	BaseModel
	OrderID     uuid.UUID       `gorm:"type:uuid;index:idx_order_role,unique;not null" json:"order_id"`
	Role        string          `gorm:"type:varchar(10);index:idx_order_role,unique;not null;default:'maker'" json:"role"` // maker or taker
	UserID      uuid.UUID       `gorm:"type:uuid;index;not null" json:"user_id"`
	Currency    string          `gorm:"type:varchar(20);index;not null" json:"currency"`
	FeeAmount   decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"fee_amount"`
	FeePercent  decimal.Decimal `gorm:"type:decimal(10,8);not null" json:"fee_percent"`
	TradeAmount decimal.Decimal `gorm:"type:decimal(20,8);not null" json:"trade_amount"` // amount fee was calculated on
}

// TableName specifies the table name for P2PTradeFee model
func (P2PTradeFee) TableName() string {
	return "p2p_trade_fees"
}

// PlatformFeeBalance holds the running total of platform fees accrued per
// currency. Updated atomically within the trade transaction for fast revenue
// reporting and reconciliation.
type PlatformFeeBalance struct {
	BaseModel
	Currency    string          `gorm:"type:varchar(20);uniqueIndex;not null" json:"currency"`
	TotalAmount decimal.Decimal `gorm:"type:decimal(20,8);default:0;not null" json:"total_amount"`
	TotalCount  int64           `gorm:"default:0;not null" json:"total_count"`
}

// TableName specifies the table name for PlatformFeeBalance model
func (PlatformFeeBalance) TableName() string {
	return "platform_fee_balances"
}
