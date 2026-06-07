package repository

import (
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// DailyFeeRow holds aggregated fee data for a single day and currency.
type DailyFeeRow struct {
	Date       string          `json:"date"`     // "YYYY-MM-DD"
	Currency   string          `json:"currency"`
	TotalFees  decimal.Decimal `json:"total_fees"`
	TradeCount int64           `json:"trade_count"`
}

// OrderStats holds aggregate counts and volume for P2P orders in a period.
type OrderStats struct {
	TotalOrders     int64           `json:"total_orders"`
	CompletedOrders int64           `json:"completed_orders"`
	DisputedOrders  int64           `json:"disputed_orders"`
	CancelledOrders int64           `json:"cancelled_orders"`
	TotalVolume     decimal.Decimal `json:"total_volume"` // sum of completed order totals (fiat)
}

// RevenueRepository provides read-only revenue and fee queries.
type RevenueRepository interface {
	GetPlatformFeeBalances() ([]models.PlatformFeeBalance, error)
	GetDailyFees(from, to time.Time, currency string) ([]DailyFeeRow, error)
	GetOrderStats(from, to time.Time) (*OrderStats, error)
}

type revenueRepository struct {
	db *gorm.DB
}

// NewRevenueRepository creates a new RevenueRepository.
func NewRevenueRepository(db *gorm.DB) RevenueRepository {
	return &revenueRepository{db: db}
}

func (r *revenueRepository) GetPlatformFeeBalances() ([]models.PlatformFeeBalance, error) {
	var balances []models.PlatformFeeBalance
	if err := r.db.Order("currency ASC").Find(&balances).Error; err != nil {
		return nil, err
	}
	return balances, nil
}

func (r *revenueRepository) GetDailyFees(from, to time.Time, currency string) ([]DailyFeeRow, error) {
	var rows []DailyFeeRow

	q := r.db.Table("p2p_trade_fees").
		Select("TO_CHAR(created_at, 'YYYY-MM-DD') AS date, currency, SUM(fee_amount) AS total_fees, COUNT(*) AS trade_count").
		Where("created_at >= ? AND created_at < ?", from, to).
		Where("deleted_at IS NULL")

	if currency != "" {
		q = q.Where("currency = ?", currency)
	}

	if err := q.Group("date, currency").Order("date DESC, currency ASC").Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *revenueRepository) GetOrderStats(from, to time.Time) (*OrderStats, error) {
	type row struct {
		Status string
		Count  int64
		Volume decimal.Decimal
	}
	var rows []row

	if err := r.db.Table("p2p_orders").
		Select("status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS volume").
		Where("created_at >= ? AND created_at < ?", from, to).
		Where("deleted_at IS NULL").
		Group("status").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	stats := &OrderStats{}
	for _, r := range rows {
		stats.TotalOrders += r.Count
		switch r.Status {
		case "completed":
			stats.CompletedOrders = r.Count
			stats.TotalVolume = r.Volume
		case "disputed":
			stats.DisputedOrders = r.Count
		case "cancelled":
			stats.CancelledOrders = r.Count
		}
	}
	return stats, nil
}
