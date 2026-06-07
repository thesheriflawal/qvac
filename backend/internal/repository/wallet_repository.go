package repository

import (
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WalletRepository handles wallet and wallet transaction queries.
type WalletRepository interface {
	// ListByUser returns all wallets for a given user.
	ListByUser(userID uuid.UUID) ([]models.Wallet, error)

	// ListTransactionsByUser returns paginated wallet transactions for a user,
	// optionally filtered by currency symbol (e.g. "USDT"). It also returns the
	// total count for pagination.
	ListTransactionsByUser(userID uuid.UUID, currency string, page, pageSize int) ([]models.WalletTransaction, int64, error)

	// GetDB returns the underlying *gorm.DB for ad-hoc queries (e.g. batch
	// loading related records in the transaction history enrichment layer).
	GetDB() *gorm.DB
}

type walletRepository struct {
	db *gorm.DB
}

// NewWalletRepository creates a new WalletRepository.
func NewWalletRepository(db *gorm.DB) WalletRepository {
	return &walletRepository{db: db}
}

func (r *walletRepository) GetDB() *gorm.DB {
	return r.db
}

func (r *walletRepository) ListByUser(userID uuid.UUID) ([]models.Wallet, error) {
	var wallets []models.Wallet
	if err := r.db.Preload("CurrencyRef").Where("user_id = ?", userID).Order("currency ASC").Find(&wallets).Error; err != nil {
		return nil, err
	}
	return wallets, nil
}

func (r *walletRepository) ListTransactionsByUser(userID uuid.UUID, currency string, page, pageSize int) ([]models.WalletTransaction, int64, error) {
	var txs []models.WalletTransaction
	var total int64

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	// Join wallets to scope transactions to the authenticated user.
	base := r.db.Table(models.WalletTransaction{}.TableName()).
		Joins("JOIN wallets ON wallets.id = wallet_transactions.wallet_id").
		Where("wallets.user_id = ?", userID)

	if currency != "" {
		base = base.Where("wallets.currency = ?", currency)
	}

	// Count total rows for pagination.
	if err := base.Model(&models.WalletTransaction{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Fetch current page, ordered by most recent first.
	// Select wallet_transactions.* plus the currency from the parent wallet so
	// the service layer can distinguish fiat vs crypto without an extra query.
	if err := base.
		Select("wallet_transactions.*, wallets.currency AS currency").
		Order("wallet_transactions.created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&txs).Error; err != nil {
		return nil, 0, err
	}

	// Preload related deposit/withdrawal records using the fetched IDs.
	// The preload re-fetches without the wallet JOIN so we must preserve the
	// currency values that were populated by the SELECT ... wallets.currency AS currency above.
	if len(txs) > 0 {
		ids := make([]uuid.UUID, len(txs))
		currencies := make(map[uuid.UUID]string, len(txs))
		for i, t := range txs {
			ids[i] = t.ID
			currencies[t.ID] = t.Currency
		}
		if err := r.db.Preload("FiatDeposit").
			Preload("FiatWithdrawal").
			Preload("CryptoDeposit").
			Preload("CryptoWithdrawal").
			Where("id IN ?", ids).
			Find(&txs).Error; err != nil {
			return nil, 0, err
		}
		for i := range txs {
			txs[i].Currency = currencies[txs[i].ID]
		}
	}

	return txs, total, nil
}
