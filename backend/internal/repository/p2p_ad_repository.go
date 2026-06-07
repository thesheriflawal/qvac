package repository

import (
	"fmt"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// TopTraderRow is the raw aggregated result for a single trader.
type TopTraderRow struct {
	UserID          uuid.UUID
	CompletedTrades int64
	LastTradeAt     time.Time
}

// TraderVolumeRow is a single per-currency crypto volume entry for a trader.
type TraderVolumeRow struct {
	UserID   uuid.UUID
	Currency string
	Volume   decimal.Decimal
}

// P2PAdRepository handles persistence for P2P ads.
type P2PAdRepository interface {
	// Create persists a new P2PAd. If tx is non-nil, it will be used; otherwise the
	// repository's base DB handle is used.
	Create(tx *gorm.DB, ad *models.P2PAd) error

	// GetTopTraders returns users ranked by completed P2P trade count.
	// currency is optional; pass "" to include all currencies.
	GetTopTraders(currency string, page, pageSize int) ([]TopTraderRow, int64, error)

	// GetTraderVolumes returns per-currency crypto volume for the given user IDs.
	// currency is optional; pass "" to return all currencies.
	GetTraderVolumes(userIDs []uuid.UUID, currency string) ([]TraderVolumeRow, error)
}

type p2pAdRepository struct {
	db *gorm.DB
}

// NewP2PAdRepository creates a new P2PAdRepository.
func NewP2PAdRepository(db *gorm.DB) P2PAdRepository {
	return &p2pAdRepository{db: db}
}

func (r *p2pAdRepository) Create(tx *gorm.DB, ad *models.P2PAd) error {
	if tx == nil {
		tx = r.db
	}
	return tx.Create(ad).Error
}

func (r *p2pAdRepository) GetTopTraders(currency string, page, pageSize int) ([]TopTraderRow, int64, error) {
	currencyFilter := ""
	args := []interface{}{}

	if currency != "" {
		currencyFilter = "AND currency = ?"
		args = append(args, currency, currency)
	}

	// Build the UNION ALL subquery that unifies buyer and seller rows.
	subquery := fmt.Sprintf(`
		SELECT buyer_id  AS user_id, created_at FROM p2p_orders WHERE status = 'completed' %s AND deleted_at IS NULL
		UNION ALL
		SELECT seller_id AS user_id, created_at FROM p2p_orders WHERE status = 'completed' %s AND deleted_at IS NULL
	`, currencyFilter, currencyFilter)

	// Count distinct traders.
	var total int64
	countQuery := fmt.Sprintf(`SELECT COUNT(DISTINCT user_id) FROM (%s) t`, subquery)
	if err := r.db.Raw(countQuery, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	// Fetch ranked page.
	offset := (page - 1) * pageSize
	dataArgs := append(args, pageSize, offset)
	dataQuery := fmt.Sprintf(`
		SELECT
			user_id,
			COUNT(*) AS completed_trades,
			MAX(created_at) AS last_trade_at
		FROM (%s) t
		GROUP BY user_id
		ORDER BY completed_trades DESC, last_trade_at DESC
		LIMIT ? OFFSET ?
	`, subquery)

	var rows []TopTraderRow
	if err := r.db.Raw(dataQuery, dataArgs...).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	return rows, total, nil
}

func (r *p2pAdRepository) GetTraderVolumes(userIDs []uuid.UUID, currency string) ([]TraderVolumeRow, error) {
	if len(userIDs) == 0 {
		return nil, nil
	}

	currencyFilter := ""
	// args order: buyer_id IN, seller_id IN for crypto query; same for NGN query
	args := []interface{}{userIDs, userIDs, userIDs, userIDs}
	if currency != "" {
		currencyFilter = "AND currency = ?"
		args = []interface{}{userIDs, currency, userIDs, currency, userIDs, userIDs}
	}

	// Crypto volume: sum of crypto amount per currency symbol.
	cryptoSubquery := fmt.Sprintf(`
		SELECT buyer_id  AS user_id, currency, amount AS vol FROM p2p_orders WHERE status = 'completed' AND buyer_id  IN (?) %s AND deleted_at IS NULL
		UNION ALL
		SELECT seller_id AS user_id, currency, amount AS vol FROM p2p_orders WHERE status = 'completed' AND seller_id IN (?) %s AND deleted_at IS NULL
	`, currencyFilter, currencyFilter)

	// NGN volume: sum of fiat total (always NGN).
	ngnSubquery := `
		SELECT buyer_id  AS user_id, 'NGN' AS currency, total AS vol FROM p2p_orders WHERE status = 'completed' AND buyer_id  IN (?) AND deleted_at IS NULL
		UNION ALL
		SELECT seller_id AS user_id, 'NGN' AS currency, total AS vol FROM p2p_orders WHERE status = 'completed' AND seller_id IN (?) AND deleted_at IS NULL
	`

	query := fmt.Sprintf(`
		SELECT user_id, currency, COALESCE(SUM(vol), 0) AS volume
		FROM (
			%s
			UNION ALL
			%s
		) t
		GROUP BY user_id, currency
	`, cryptoSubquery, ngnSubquery)

	var rows []TraderVolumeRow
	if err := r.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}

	return rows, nil
}
