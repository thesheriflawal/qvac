package repository

import (
	"errors"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ReferralRepository handles referral data operations.
type ReferralRepository interface {
	// Referral CRUD
	Create(referral *models.Referral) error
	FindByRefereeID(refereeID uuid.UUID) (*models.Referral, error)
	ListByReferrerID(referrerID uuid.UUID, page, pageSize int) ([]models.Referral, int64, error)
	ListAllReferrals(page, pageSize int, status string) ([]models.Referral, int64, error)
	ListByReferrerIDAdmin(referrerID uuid.UUID, page, pageSize int) ([]models.Referral, int64, error)
	CountByReferrerID(referrerID uuid.UUID) (int64, error)
	UpdateStatus(id uuid.UUID, status string) error

	// Points
	GetOrCreatePointBalance(userID uuid.UUID) (*models.ReferralPointBalance, error)
	AddPointTransaction(ptx *models.ReferralPointTransaction) error
	ListPointTransactions(userID uuid.UUID, page, pageSize int) ([]models.ReferralPointTransaction, int64, error)
	SumPointsInWindow(userID uuid.UUID, since, until time.Time) (decimal.Decimal, error)
	SumAllPointsInWindow(since, until time.Time) (decimal.Decimal, error)

	// Config
	GetConfig(key string) (*models.ReferralConfig, error)
	UpsertConfig(key, value, description string) error
	ListConfigs() ([]models.ReferralConfig, error)

	// Eligibility
	CountCompletedP2PTrades(userID uuid.UUID, since, until time.Time) (int64, error)

	// Claim cycles
	CreateClaimCycle(cycle *models.ReferralClaimCycle) error
	FindClaimCycleByQuarter(quarter string) (*models.ReferralClaimCycle, error)
	FindOpenClaimCycle() (*models.ReferralClaimCycle, error)
	ListClaimCycles() ([]models.ReferralClaimCycle, error)
	CloseClaimCycle(id uuid.UUID) error

	// Leaderboard
	GetLeaderboard(since, until time.Time, limit int) ([]LeaderboardRow, error)

	// Claims
	CreateClaim(claim *models.ReferralClaim) error
	FindClaimByUserAndCycle(userID, cycleID uuid.UUID) (*models.ReferralClaim, error)
	ListClaimsByUser(userID uuid.UUID, page, pageSize int) ([]models.ReferralClaim, int64, error)
}

// LeaderboardRow is a single row returned by the leaderboard query.
type LeaderboardRow struct {
	UserID      uuid.UUID       `json:"user_id"`
	TotalPoints decimal.Decimal `json:"total_points"`
}

type referralRepository struct {
	db *gorm.DB
}

// NewReferralRepository creates a new referral repository.
func NewReferralRepository(db *gorm.DB) ReferralRepository {
	return &referralRepository{db: db}
}

// ---------------------------------------------------------------------------
// Referral CRUD
// ---------------------------------------------------------------------------

func (r *referralRepository) Create(referral *models.Referral) error {
	return r.db.Create(referral).Error
}

func (r *referralRepository) FindByRefereeID(refereeID uuid.UUID) (*models.Referral, error) {
	var ref models.Referral
	err := r.db.Where("referee_id = ?", refereeID).First(&ref).Error
	if err != nil {
		return nil, err
	}
	return &ref, nil
}

func (r *referralRepository) ListByReferrerID(referrerID uuid.UUID, page, pageSize int) ([]models.Referral, int64, error) {
	var refs []models.Referral
	var total int64

	q := r.db.Model(&models.Referral{}).Where("referrer_id = ?", referrerID)

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Preload("Referee").Preload("Referee.Profile").Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&refs).Error; err != nil {
		return nil, 0, err
	}

	return refs, total, nil
}

func (r *referralRepository) CountByReferrerID(referrerID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&models.Referral{}).Where("referrer_id = ?", referrerID).Count(&count).Error
	return count, err
}

func (r *referralRepository) UpdateStatus(id uuid.UUID, status string) error {
	return r.db.Model(&models.Referral{}).Where("id = ?", id).Update("status", status).Error
}

func (r *referralRepository) ListAllReferrals(page, pageSize int, status string) ([]models.Referral, int64, error) {
	var refs []models.Referral
	var total int64

	q := r.db.Model(&models.Referral{})
	if status != "" {
		q = q.Where("status = ?", status)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Preload("Referrer").Preload("Referee").Preload("Referee.Profile").
		Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&refs).Error; err != nil {
		return nil, 0, err
	}

	return refs, total, nil
}

func (r *referralRepository) ListByReferrerIDAdmin(referrerID uuid.UUID, page, pageSize int) ([]models.Referral, int64, error) {
	var refs []models.Referral
	var total int64

	q := r.db.Model(&models.Referral{}).Where("referrer_id = ?", referrerID)

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Preload("Referee").Preload("Referee.Profile").
		Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&refs).Error; err != nil {
		return nil, 0, err
	}

	return refs, total, nil
}

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

func (r *referralRepository) GetOrCreatePointBalance(userID uuid.UUID) (*models.ReferralPointBalance, error) {
	var bal models.ReferralPointBalance
	err := r.db.Where("user_id = ?", userID).First(&bal).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			bal = models.ReferralPointBalance{
				UserID:      userID,
				TotalPoints: decimal.Zero,
			}
			if err := r.db.Create(&bal).Error; err != nil {
				return nil, err
			}
			return &bal, nil
		}
		return nil, err
	}
	return &bal, nil
}

func (r *referralRepository) AddPointTransaction(ptx *models.ReferralPointTransaction) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(ptx).Error; err != nil {
			return err
		}

		// Atomically UPSERT the referrer's point balance. ON CONFLICT handles
		// the race where two concurrent goroutines both see no existing row and
		// attempt to INSERT — the second insert increments instead of failing.
		return tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"total_points": gorm.Expr("referral_point_balances.total_points + ?", ptx.PointsEarned),
			}),
		}).Create(&models.ReferralPointBalance{
			UserID:      ptx.ReferrerID,
			TotalPoints: ptx.PointsEarned,
		}).Error
	})
}

func (r *referralRepository) ListPointTransactions(userID uuid.UUID, page, pageSize int) ([]models.ReferralPointTransaction, int64, error) {
	var txs []models.ReferralPointTransaction
	var total int64

	q := r.db.Model(&models.ReferralPointTransaction{}).Where("referrer_id = ?", userID)

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&txs).Error; err != nil {
		return nil, 0, err
	}

	return txs, total, nil
}

func (r *referralRepository) SumPointsInWindow(userID uuid.UUID, since, until time.Time) (decimal.Decimal, error) {
	var result struct {
		Total decimal.Decimal
	}
	err := r.db.Model(&models.ReferralPointTransaction{}).
		Select("COALESCE(SUM(points_earned), 0) as total").
		Where("referrer_id = ? AND created_at >= ? AND created_at < ?", userID, since, until).
		Scan(&result).Error
	return result.Total, err
}

func (r *referralRepository) SumAllPointsInWindow(since, until time.Time) (decimal.Decimal, error) {
	var result struct {
		Total decimal.Decimal
	}
	err := r.db.Model(&models.ReferralPointTransaction{}).
		Select("COALESCE(SUM(points_earned), 0) as total").
		Where("created_at >= ? AND created_at < ?", since, until).
		Scan(&result).Error
	return result.Total, err
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

func (r *referralRepository) GetConfig(key string) (*models.ReferralConfig, error) {
	var cfg models.ReferralConfig
	err := r.db.Where("key = ?", key).First(&cfg).Error
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (r *referralRepository) UpsertConfig(key, value, description string) error {
	cfg := models.ReferralConfig{
		Key:         key,
		Value:       value,
		Description: description,
	}
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "description", "updated_at"}),
	}).Create(&cfg).Error
}

func (r *referralRepository) ListConfigs() ([]models.ReferralConfig, error) {
	var cfgs []models.ReferralConfig
	err := r.db.Order("key ASC").Find(&cfgs).Error
	return cfgs, err
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

func (r *referralRepository) CountCompletedP2PTrades(userID uuid.UUID, since, until time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&models.P2POrder{}).
		Where("status = ? AND (buyer_id = ? OR seller_id = ?) AND created_at >= ? AND created_at < ?",
			"completed", userID, userID, since, until).
		Count(&count).Error
	return count, err
}

// ---------------------------------------------------------------------------
// Claim cycles
// ---------------------------------------------------------------------------

func (r *referralRepository) CreateClaimCycle(cycle *models.ReferralClaimCycle) error {
	return r.db.Create(cycle).Error
}

func (r *referralRepository) FindClaimCycleByQuarter(quarter string) (*models.ReferralClaimCycle, error) {
	var cycle models.ReferralClaimCycle
	err := r.db.Where("quarter = ?", quarter).First(&cycle).Error
	if err != nil {
		return nil, err
	}
	return &cycle, nil
}

func (r *referralRepository) FindOpenClaimCycle() (*models.ReferralClaimCycle, error) {
	var cycle models.ReferralClaimCycle
	err := r.db.Where("status = ?", models.ClaimCycleStatusOpen).First(&cycle).Error
	if err != nil {
		return nil, err
	}
	return &cycle, nil
}

func (r *referralRepository) ListClaimCycles() ([]models.ReferralClaimCycle, error) {
	var cycles []models.ReferralClaimCycle
	err := r.db.Order("created_at DESC").Find(&cycles).Error
	return cycles, err
}

func (r *referralRepository) CloseClaimCycle(id uuid.UUID) error {
	now := time.Now().UTC()
	return r.db.Model(&models.ReferralClaimCycle{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":    models.ClaimCycleStatusClosed,
			"closed_at": now,
		}).Error
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

func (r *referralRepository) GetLeaderboard(since, until time.Time, limit int) ([]LeaderboardRow, error) {
	var rows []LeaderboardRow
	err := r.db.Model(&models.ReferralPointTransaction{}).
		Select("referrer_id as user_id, COALESCE(SUM(points_earned), 0) as total_points").
		Where("created_at >= ? AND created_at < ?", since, until).
		Group("referrer_id").
		Order("total_points DESC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

func (r *referralRepository) CreateClaim(claim *models.ReferralClaim) error {
	return r.db.Create(claim).Error
}

func (r *referralRepository) FindClaimByUserAndCycle(userID, cycleID uuid.UUID) (*models.ReferralClaim, error) {
	var claim models.ReferralClaim
	err := r.db.Where("user_id = ? AND claim_cycle_id = ?", userID, cycleID).First(&claim).Error
	if err != nil {
		return nil, err
	}
	return &claim, nil
}

func (r *referralRepository) ListClaimsByUser(userID uuid.UUID, page, pageSize int) ([]models.ReferralClaim, int64, error) {
	var claims []models.ReferralClaim
	var total int64

	q := r.db.Model(&models.ReferralClaim{}).Where("user_id = ?", userID)

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Preload("ClaimCycle").Order("claimed_at DESC").Offset(offset).Limit(pageSize).Find(&claims).Error; err != nil {
		return nil, 0, err
	}

	return claims, total, nil
}
