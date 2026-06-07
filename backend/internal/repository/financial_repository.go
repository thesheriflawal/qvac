package repository

import (
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// FinancialListFilters holds optional filter criteria for financial list queries.
type FinancialListFilters struct {
	Status   string // e.g. "pending", "confirmed", "processing", "completed", "failed"
	Currency string
}

// CountAmount holds a count and total amount aggregate.
type CountAmount struct {
	Count  int64           `json:"count"`
	Amount decimal.Decimal `json:"amount"`
}

// WalletBalanceSummary holds the total balance across all users for one currency.
type WalletBalanceSummary struct {
	Currency     string          `json:"currency"`
	TotalBalance decimal.Decimal `json:"total_balance"`
	WalletCount  int64           `json:"wallet_count"`
}

// walletBalanceRaw is an intermediate scan target before unit conversion.
type walletBalanceRaw struct {
	Currency        string
	TotalBalanceRaw int64
	WalletCount     int64
	Decimals        int
}

// FinancialSummary is the payload returned by GET /admin/finance/summary.
type FinancialSummary struct {
	WalletBalances              []WalletBalanceSummary `json:"wallet_balances"`
	PendingCryptoDeposits       CountAmount            `json:"pending_crypto_deposits"`
	PendingFiatDeposits         CountAmount            `json:"pending_fiat_deposits"`
	ProcessingCryptoWithdrawals CountAmount            `json:"processing_crypto_withdrawals"`
	ProcessingFiatWithdrawals   CountAmount            `json:"processing_fiat_withdrawals"`
}

// enriched row types — flat structs to avoid GORM embedded-scan issues.

type CryptoDepositRow struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	UserEmail string          `json:"user_email"`
	UserUID   string          `json:"user_uid"`
	Currency  string          `json:"currency"`
	Network   string          `json:"network"`
	TxHash    string          `json:"tx_hash"`
	Amount    decimal.Decimal `json:"amount"`
	Status    string          `json:"status"`
	CreatedAt time.Time       `json:"created_at"`
}

type FiatDepositRow struct {
	ID            uuid.UUID       `json:"id"`
	UserID        uuid.UUID       `json:"user_id"`
	UserEmail     string          `json:"user_email"`
	UserUID       string          `json:"user_uid"`
	Amount        decimal.Decimal `json:"amount"`
	BankName      string          `json:"bank_name"`
	AccountNumber string          `json:"account_number"`
	Reference     string          `json:"reference"`
	Status        string          `json:"status"`
	CreatedAt     time.Time       `json:"created_at"`
}

type CryptoWithdrawalRow struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	UserEmail string          `json:"user_email"`
	UserUID   string          `json:"user_uid"`
	Currency  string          `json:"currency"`
	Address   string          `json:"address"`
	Amount    decimal.Decimal `json:"amount"`
	Fee       decimal.Decimal `json:"fee"`
	TxHash    string          `json:"tx_hash,omitempty"`
	Status    string          `json:"status"`
	CreatedAt time.Time       `json:"created_at"`
}

type FiatWithdrawalRow struct {
	ID            uuid.UUID       `json:"id"`
	UserID        uuid.UUID       `json:"user_id"`
	UserEmail     string          `json:"user_email"`
	UserUID       string          `json:"user_uid"`
	Amount        decimal.Decimal `json:"amount"`
	Fee           decimal.Decimal `json:"fee"`
	StampDuty     decimal.Decimal `json:"stamp_duty"`
	TotalFee      decimal.Decimal `json:"total_fee"`
	BankName      string          `json:"bank_name"`
	AccountNumber string          `json:"account_number"`
	Status        string          `json:"status"`
	CreatedAt     time.Time       `json:"created_at"`
}

type InternalTransferRow struct {
	ID            uuid.UUID       `json:"id"`
	SenderID      uuid.UUID       `json:"sender_id"`
	SenderEmail   string          `json:"sender_email"`
	SenderUID     string          `json:"sender_uid"`
	ReceiverID    uuid.UUID       `json:"receiver_id"`
	ReceiverEmail string          `json:"receiver_email"`
	ReceiverUID   string          `json:"receiver_uid"`
	Currency      string          `json:"currency"`
	Amount        decimal.Decimal `json:"amount"`
	Status        string          `json:"status"`
	CreatedAt     time.Time       `json:"created_at"`
}

// WalletDiscrepancy represents a wallet whose stored balance does not match
// the net sum of its wallet_transactions (balance_after - balance_before).
type WalletDiscrepancy struct {
	WalletID      uuid.UUID       `json:"wallet_id"`
	UserID        uuid.UUID       `json:"user_id"`
	UserEmail     string          `json:"user_email"`
	Currency      string          `json:"currency"`
	StoredBalance decimal.Decimal `json:"stored_balance"`  // from wallets.balance (converted)
	TxNetBalance  decimal.Decimal `json:"tx_net_balance"`  // SUM(balance_after - balance_before)
	Discrepancy   decimal.Decimal `json:"discrepancy"`     // stored - tx_net
	TxCount       int64           `json:"tx_count"`
}

// WalletVerificationResult is the payload returned by GET /admin/finance/verify-balances.
type WalletVerificationResult struct {
	TotalWallets      int64               `json:"total_wallets"`
	DiscrepancyCount  int64               `json:"discrepancy_count"`
	Discrepancies     []WalletDiscrepancy `json:"discrepancies"`
}

// FinancialRepository provides admin-only financial overview queries.
type FinancialRepository interface {
	GetSummary() (*FinancialSummary, error)
	ListCryptoDeposits(filters FinancialListFilters, page, pageSize int) ([]CryptoDepositRow, int64, error)
	ListFiatDeposits(filters FinancialListFilters, page, pageSize int) ([]FiatDepositRow, int64, error)
	ListCryptoWithdrawals(filters FinancialListFilters, page, pageSize int) ([]CryptoWithdrawalRow, int64, error)
	ListFiatWithdrawals(filters FinancialListFilters, page, pageSize int) ([]FiatWithdrawalRow, int64, error)
	ListInternalTransfers(page, pageSize int) ([]InternalTransferRow, int64, error)
	VerifyWalletBalances(currency string) (*WalletVerificationResult, error)
}

type financialRepository struct {
	db *gorm.DB
}

// NewFinancialRepository creates a new FinancialRepository.
func NewFinancialRepository(db *gorm.DB) FinancialRepository {
	return &financialRepository{db: db}
}

func (r *financialRepository) GetSummary() (*FinancialSummary, error) {
	// Wallet balances grouped by currency, joined to get decimals for unit conversion.
	var rawBalances []walletBalanceRaw
	if err := r.db.Model(&models.Wallet{}).
		Joins("JOIN currencies ON currencies.symbol = wallets.currency AND currencies.deleted_at IS NULL").
		Select("wallets.currency, SUM(wallets.balance) AS total_balance_raw, COUNT(*) AS wallet_count, currencies.decimals").
		Where("wallets.deleted_at IS NULL").
		Group("wallets.currency, currencies.decimals").
		Order("wallets.currency ASC").
		Scan(&rawBalances).Error; err != nil {
		return nil, err
	}

	walletBalances := make([]WalletBalanceSummary, len(rawBalances))
	for i, r := range rawBalances {
		walletBalances[i] = WalletBalanceSummary{
			Currency:     r.Currency,
			TotalBalance: utils.FromStorageUnits(r.TotalBalanceRaw, r.Decimals),
			WalletCount:  r.WalletCount,
		}
	}

	aggregate := func(table, status string) (CountAmount, error) {
		type row struct {
			Count  int64
			Amount decimal.Decimal
		}
		var res row
		err := r.db.Table(table).
			Select("COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount").
			Where("status = ? AND deleted_at IS NULL", status).
			Scan(&res).Error
		return CountAmount{Count: res.Count, Amount: res.Amount}, err
	}

	pendingCrypto, err := aggregate("crypto_deposits", "pending")
	if err != nil {
		return nil, err
	}
	pendingFiat, err := aggregate("fiat_deposits", "pending")
	if err != nil {
		return nil, err
	}
	processingCryptoW, err := aggregate("crypto_withdrawals", "processing")
	if err != nil {
		return nil, err
	}
	processingFiatW, err := aggregate("fiat_withdrawals", "processing")
	if err != nil {
		return nil, err
	}

	return &FinancialSummary{
		WalletBalances:              walletBalances,
		PendingCryptoDeposits:       pendingCrypto,
		PendingFiatDeposits:         pendingFiat,
		ProcessingCryptoWithdrawals: processingCryptoW,
		ProcessingFiatWithdrawals:   processingFiatW,
	}, nil
}

func (r *financialRepository) ListCryptoDeposits(filters FinancialListFilters, page, pageSize int) ([]CryptoDepositRow, int64, error) {
	var rows []CryptoDepositRow
	var total int64

	q := r.db.Table("crypto_deposits").
		Joins("JOIN users ON users.id = crypto_deposits.user_id AND users.deleted_at IS NULL").
		Select("crypto_deposits.id, crypto_deposits.user_id, users.email AS user_email, users.uid AS user_uid, crypto_deposits.currency, crypto_deposits.network, crypto_deposits.tx_hash, crypto_deposits.amount, crypto_deposits.status, crypto_deposits.created_at").
		Where("crypto_deposits.deleted_at IS NULL")

	if filters.Status != "" {
		q = q.Where("crypto_deposits.status = ?", filters.Status)
	}
	if filters.Currency != "" {
		q = q.Where("crypto_deposits.currency = ?", filters.Currency)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Order("crypto_deposits.created_at DESC").Offset(offset).Limit(pageSize).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (r *financialRepository) ListFiatDeposits(filters FinancialListFilters, page, pageSize int) ([]FiatDepositRow, int64, error) {
	var rows []FiatDepositRow
	var total int64

	q := r.db.Table("fiat_deposits").
		Joins("JOIN users ON users.id = fiat_deposits.user_id AND users.deleted_at IS NULL").
		Select("fiat_deposits.id, fiat_deposits.user_id, users.email AS user_email, users.uid AS user_uid, fiat_deposits.amount, fiat_deposits.bank_name, fiat_deposits.account_number, fiat_deposits.reference, fiat_deposits.status, fiat_deposits.created_at").
		Where("fiat_deposits.deleted_at IS NULL")

	if filters.Status != "" {
		q = q.Where("fiat_deposits.status = ?", filters.Status)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Order("fiat_deposits.created_at DESC").Offset(offset).Limit(pageSize).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (r *financialRepository) ListCryptoWithdrawals(filters FinancialListFilters, page, pageSize int) ([]CryptoWithdrawalRow, int64, error) {
	var rows []CryptoWithdrawalRow
	var total int64

	q := r.db.Table("crypto_withdrawals").
		Joins("JOIN users ON users.id = crypto_withdrawals.user_id AND users.deleted_at IS NULL").
		Select("crypto_withdrawals.id, crypto_withdrawals.user_id, users.email AS user_email, users.uid AS user_uid, crypto_withdrawals.currency, crypto_withdrawals.address, crypto_withdrawals.amount, crypto_withdrawals.fee, crypto_withdrawals.tx_hash, crypto_withdrawals.status, crypto_withdrawals.created_at").
		Where("crypto_withdrawals.deleted_at IS NULL")

	if filters.Status != "" {
		q = q.Where("crypto_withdrawals.status = ?", filters.Status)
	}
	if filters.Currency != "" {
		q = q.Where("crypto_withdrawals.currency = ?", filters.Currency)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Order("crypto_withdrawals.created_at DESC").Offset(offset).Limit(pageSize).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (r *financialRepository) ListFiatWithdrawals(filters FinancialListFilters, page, pageSize int) ([]FiatWithdrawalRow, int64, error) {
	var rows []FiatWithdrawalRow
	var total int64

	q := r.db.Table("fiat_withdrawals").
		Joins("JOIN users ON users.id = fiat_withdrawals.user_id AND users.deleted_at IS NULL").
		Select("fiat_withdrawals.id, fiat_withdrawals.user_id, users.email AS user_email, users.uid AS user_uid, fiat_withdrawals.amount, fiat_withdrawals.fee, fiat_withdrawals.stamp_duty, fiat_withdrawals.total_fee, fiat_withdrawals.bank_name, fiat_withdrawals.account_number, fiat_withdrawals.status, fiat_withdrawals.created_at").
		Where("fiat_withdrawals.deleted_at IS NULL")

	if filters.Status != "" {
		q = q.Where("fiat_withdrawals.status = ?", filters.Status)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Order("fiat_withdrawals.created_at DESC").Offset(offset).Limit(pageSize).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (r *financialRepository) ListInternalTransfers(page, pageSize int) ([]InternalTransferRow, int64, error) {
	var rows []InternalTransferRow
	var total int64

	q := r.db.Table("internal_transfers").
		Joins("JOIN users AS sender ON sender.id = internal_transfers.sender_id AND sender.deleted_at IS NULL").
		Joins("JOIN users AS receiver ON receiver.id = internal_transfers.receiver_id AND receiver.deleted_at IS NULL").
		Select("internal_transfers.id, internal_transfers.sender_id, sender.email AS sender_email, sender.uid AS sender_uid, internal_transfers.receiver_id, receiver.email AS receiver_email, receiver.uid AS receiver_uid, internal_transfers.currency, internal_transfers.amount, internal_transfers.status, internal_transfers.created_at").
		Where("internal_transfers.deleted_at IS NULL")

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Order("internal_transfers.created_at DESC").Offset(offset).Limit(pageSize).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (r *financialRepository) VerifyWalletBalances(currency string) (*WalletVerificationResult, error) {
	// Single query: for every wallet, compute stored balance (int64 → decimal via
	// currency decimals) and compare it against the net sum of wallet_transactions
	// (SUM(balance_after - balance_before)). Only wallets where the two differ by
	// more than a rounding epsilon are flagged as discrepancies.
	//
	// Cost note: this is a full scan of wallet_transactions grouped by wallet_id.
	// It is intentionally admin-only and on-demand; do not call it in hot paths.
	type rawRow struct {
		WalletID   uuid.UUID
		UserID     uuid.UUID
		UserEmail  string
		Currency   string
		BalanceRaw int64
		Decimals   int
		TxNet      decimal.Decimal
		TxCount    int64
	}

	q := r.db.Table("wallets").
		Joins("JOIN currencies ON currencies.symbol = wallets.currency AND currencies.deleted_at IS NULL").
		Joins("JOIN users ON users.id = wallets.user_id AND users.deleted_at IS NULL").
		Joins("LEFT JOIN wallet_transactions ON wallet_transactions.wallet_id = wallets.id").
		Select(`
			wallets.id          AS wallet_id,
			wallets.user_id     AS user_id,
			users.email         AS user_email,
			wallets.currency    AS currency,
			wallets.balance     AS balance_raw,
			currencies.decimals AS decimals,
			COALESCE(SUM(wallet_transactions.balance_after - wallet_transactions.balance_before), 0) AS tx_net,
			COUNT(wallet_transactions.id) AS tx_count
		`).
		Where("wallets.deleted_at IS NULL").
		Group("wallets.id, wallets.user_id, users.email, wallets.currency, wallets.balance, currencies.decimals")

	if currency != "" {
		q = q.Where("wallets.currency = ?", currency)
	}

	var rows []rawRow
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}

	result := &WalletVerificationResult{
		TotalWallets:  int64(len(rows)),
		Discrepancies: []WalletDiscrepancy{},
	}

	epsilon := decimal.NewFromFloat(1e-8)
	for _, row := range rows {
		stored := utils.FromStorageUnits(row.BalanceRaw, row.Decimals)
		diff := stored.Sub(row.TxNet).Abs()
		if diff.GreaterThan(epsilon) {
			result.DiscrepancyCount++
			result.Discrepancies = append(result.Discrepancies, WalletDiscrepancy{
				WalletID:      row.WalletID,
				UserID:        row.UserID,
				UserEmail:     row.UserEmail,
				Currency:      row.Currency,
				StoredBalance: stored,
				TxNetBalance:  row.TxNet,
				Discrepancy:   stored.Sub(row.TxNet),
				TxCount:       row.TxCount,
			})
		}
	}

	return result, nil
}
