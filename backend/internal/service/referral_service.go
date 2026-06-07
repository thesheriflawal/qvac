package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ReferralService defines referral-related business logic.
type ReferralService interface {
	// Registration
	ApplyReferralCode(referrerCode string, referee *models.User) error

	// User-facing queries
	GetMyReferralInfo(userID uuid.UUID) (*ReferralInfo, error)
	ListMyReferrals(userID uuid.UUID, page, pageSize int) ([]ReferralEntry, int64, error)
	ListMyPointTransactions(userID uuid.UUID, page, pageSize int) ([]models.ReferralPointTransaction, int64, error)

	// P2P point accrual
	AwardPointsForP2POrder(ctx context.Context, refereeID uuid.UUID, orderID uuid.UUID, volumeUSD decimal.Decimal) error

	// Claims (user)
	ClaimReward(userID uuid.UUID) (*models.ReferralClaim, error)
	ListMyClaims(userID uuid.UUID, page, pageSize int) ([]models.ReferralClaimResponse, int64, error)

	// Leaderboard
	GetLeaderboard(limit int) ([]LeaderboardEntry, error)

	// Admin: referrals
	AdminListAllReferrals(page, pageSize int, status string) ([]AdminReferralEntry, int64, error)
	AdminListReferralsByUser(referrerID uuid.UUID, page, pageSize int) ([]AdminReferralEntry, int64, error)

	// Admin: config
	GetConfig(key string) (string, error)
	UpdateConfig(key, value string) error
	ListConfigs() ([]models.ReferralConfig, error)

	// Admin: claim cycles
	OpenClaimCycle(quarter string, poolAmountFiat decimal.Decimal, currency string) (*models.ReferralClaimCycle, error)
	CloseClaimCycle(id uuid.UUID) error
	ListClaimCycles() ([]models.ReferralClaimCycle, error)
}

// ReferralInfo is the aggregate response for GET /users/me/referral.
type ReferralInfo struct {
	ReferralCode       string          `json:"referral_code"`
	TotalReferrals     int64           `json:"total_referrals"`
	TotalPoints        decimal.Decimal `json:"total_points"`
	QuarterTradeCount  int64           `json:"quarter_trade_count"`
	RequiredTradeCount int64           `json:"required_trade_count"`
	Eligible           bool            `json:"eligible"`
	CurrentQuarter     string          `json:"current_quarter"`
}

// ReferralEntry is a single referred user for list responses.
type ReferralEntry struct {
	RefereeID  uuid.UUID `json:"referee_id"`
	RefereeUID string    `json:"referee_uid"`
	Email      string    `json:"email"`
	Username   string    `json:"username"`
	Status     string    `json:"status"` // "active" or "inactive" for the current quarter
	CreatedAt  string    `json:"created_at"`
}

// AdminReferralEntry is a referral record for admin list responses.
type AdminReferralEntry struct {
	ID              uuid.UUID `json:"id"`
	ReferrerID      uuid.UUID `json:"referrer_id"`
	ReferrerUID     string    `json:"referrer_uid"`
	ReferrerEmail   string    `json:"referrer_email"`
	RefereeID       uuid.UUID `json:"referee_id"`
	RefereeUID      string    `json:"referee_uid"`
	RefereeUsername string    `json:"referee_username"`
	Status          string    `json:"status"`
	CreatedAt       string    `json:"created_at"`
}

// LeaderboardEntry is a single user on the referral leaderboard.
type LeaderboardEntry struct {
	Rank        int             `json:"rank"`
	Username    string          `json:"username"`
	TotalPoints decimal.Decimal `json:"total_points"`
}

type referralService struct {
	referralRepo repository.ReferralRepository
	userRepo     repository.UserRepository
	priceService PriceService
}

// NewReferralService creates a new ReferralService.
func NewReferralService(
	referralRepo repository.ReferralRepository,
	userRepo repository.UserRepository,
	priceService PriceService,
) ReferralService {
	return &referralService{
		referralRepo: referralRepo,
		userRepo:     userRepo,
		priceService: priceService,
	}
}

// ---------------------------------------------------------------------------
// Quarter helpers
// ---------------------------------------------------------------------------

// quarterWindow returns the [start, end) time window for a quarter string
// like "2026-Q1".
func quarterWindow(q string) (time.Time, time.Time, error) {
	parts := strings.SplitN(q, "-Q", 2)
	if len(parts) != 2 {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid quarter format: %s", q)
	}
	year, err := strconv.Atoi(parts[0])
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid quarter year: %s", q)
	}
	qNum, err := strconv.Atoi(parts[1])
	if err != nil || qNum < 1 || qNum > 4 {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid quarter number: %s", q)
	}
	startMonth := time.Month((qNum-1)*3 + 1)
	start := time.Date(year, startMonth, 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 3, 0)
	return start, end, nil
}

// currentQuarter returns the quarter string (e.g. "2026-Q1") and window for now.
func currentQuarter() (string, time.Time, time.Time) {
	now := time.Now().UTC()
	q := (int(now.Month())-1)/3 + 1
	label := fmt.Sprintf("%d-Q%d", now.Year(), q)
	startMonth := time.Month((q-1)*3 + 1)
	start := time.Date(now.Year(), startMonth, 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 3, 0)
	return label, start, end
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

func (s *referralService) ApplyReferralCode(referrerCode string, referee *models.User) error {
	referrerCode = strings.ToUpper(strings.TrimSpace(referrerCode))
	if referrerCode == "" {
		return nil // no-op if not provided
	}

	if referee == nil {
		return utils.NewSafeError("referee user is required")
	}

	// Look up referrer by code.
	referrer, err := s.findUserByReferralCode(referrerCode)
	if err != nil {
		return utils.NewSafeError("invalid referral code")
	}

	// Cannot refer yourself.
	if referrer.ID == referee.ID {
		return utils.NewSafeError("cannot use your own referral code")
	}

	// Check if referee already has a referrer.
	_, err = s.referralRepo.FindByRefereeID(referee.ID)
	if err == nil {
		return utils.NewSafeError("referral code already applied")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	ref := &models.Referral{
		ReferrerID: referrer.ID,
		RefereeID:  referee.ID,
		Status:     models.ReferralStatusPending,
	}

	return s.referralRepo.Create(ref)
}

func (s *referralService) findUserByReferralCode(code string) (*models.User, error) {
	db := database.GetDB()
	var user models.User
	err := db.Where("referral_code = ?", code).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// ---------------------------------------------------------------------------
// User-facing queries
// ---------------------------------------------------------------------------

func (s *referralService) GetMyReferralInfo(userID uuid.UUID) (*ReferralInfo, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, err
	}

	totalReferrals, err := s.referralRepo.CountByReferrerID(userID)
	if err != nil {
		return nil, err
	}

	bal, err := s.referralRepo.GetOrCreatePointBalance(userID)
	if err != nil {
		return nil, err
	}

	quarterLabel, qStart, qEnd := currentQuarter()

	tradeCount, err := s.referralRepo.CountCompletedP2PTrades(userID, qStart, qEnd)
	if err != nil {
		return nil, err
	}

	requiredTrades := int64(3) // default
	if cfg, err := s.referralRepo.GetConfig(models.ReferralConfigMinTradesEligibility); err == nil {
		if v, err := strconv.ParseInt(cfg.Value, 10, 64); err == nil {
			requiredTrades = v
		}
	}

	return &ReferralInfo{
		ReferralCode:       user.ReferralCode,
		TotalReferrals:     totalReferrals,
		TotalPoints:        bal.TotalPoints,
		QuarterTradeCount:  tradeCount,
		RequiredTradeCount: requiredTrades,
		Eligible:           tradeCount >= requiredTrades,
		CurrentQuarter:     quarterLabel,
	}, nil
}

func (s *referralService) ListMyReferrals(userID uuid.UUID, page, pageSize int) ([]ReferralEntry, int64, error) {
	refs, total, err := s.referralRepo.ListByReferrerID(userID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	

	// Determine the current quarter window and the min-trades threshold
	// so we can label each referee as "active" or "inactive".
	_, qStart, qEnd := currentQuarter()

	requiredTrades := int64(3)
	if cfg, err := s.referralRepo.GetConfig(models.ReferralConfigMinTradesEligibility); err == nil {
		if v, err := strconv.ParseInt(cfg.Value, 10, 64); err == nil {
			requiredTrades = v
		}
	}

	entries := make([]ReferralEntry, 0, len(refs))
	for _, r := range refs {
		status := "inactive"
		if tc, err := s.referralRepo.CountCompletedP2PTrades(r.RefereeID, qStart, qEnd); err == nil && tc >= requiredTrades {
			status = "active"
		}

		entry := ReferralEntry{
			RefereeID: r.RefereeID,
			Status:    status,
			CreatedAt: r.CreatedAt.Format(time.RFC3339),
		}
		if r.Referee != nil {
			entry.RefereeUID = r.Referee.UID
			entry.Username = r.Referee.Profile.Username
		}
		entries = append(entries, entry)
	}

	return entries, total, nil
}

func (s *referralService) ListMyPointTransactions(userID uuid.UUID, page, pageSize int) ([]models.ReferralPointTransaction, int64, error) {
	return s.referralRepo.ListPointTransactions(userID, page, pageSize)
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

func (s *referralService) GetLeaderboard(limit int) ([]LeaderboardEntry, error) {
	if limit <= 0 || limit > 100 {
		limit = 10
	}

	_, qStart, qEnd := currentQuarter()

	rows, err := s.referralRepo.GetLeaderboard(qStart, qEnd, limit)
	if err != nil {
		return nil, err
	}

	entries := make([]LeaderboardEntry, 0, len(rows))
	for i, row := range rows {
		entry := LeaderboardEntry{
			Rank:        i + 1,
			TotalPoints: row.TotalPoints,
		}
		if user, err := s.userRepo.FindByID(row.UserID); err == nil {
			entry.Username = user.Profile.Username
		}
		entries = append(entries, entry)
	}

	return entries, nil
}

// ---------------------------------------------------------------------------
// P2P point accrual
// ---------------------------------------------------------------------------

func (s *referralService) AwardPointsForP2POrder(ctx context.Context, refereeID uuid.UUID, orderID uuid.UUID, volumeUSD decimal.Decimal) error {
	if !volumeUSD.IsPositive() {
		return nil // nothing to award
	}

	// Check if referee was referred by someone.
	ref, err := s.referralRepo.FindByRefereeID(refereeID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil // not a referred user
		}
		return err
	}

	referrerID := ref.ReferrerID

	// Check eligibility: referrer must have ≥ min_trades completed P2P trades this quarter.
	_, qStart, qEnd := currentQuarter()

	requiredTrades := int64(3)
	if cfg, err := s.referralRepo.GetConfig(models.ReferralConfigMinTradesEligibility); err == nil {
		if v, err := strconv.ParseInt(cfg.Value, 10, 64); err == nil {
			requiredTrades = v
		}
	}

	tradeCount, err := s.referralRepo.CountCompletedP2PTrades(referrerID, qStart, qEnd)
	if err != nil {
		return err
	}

	if tradeCount < requiredTrades {
		logger.Debug("Referrer not eligible for points (insufficient trades)",
			zap.String("referrer_id", referrerID.String()),
			zap.Int64("trade_count", tradeCount),
			zap.Int64("required", requiredTrades),
		)
		return nil
	}

	// Get points rate from config.
	pointsPerUSD := decimal.NewFromFloat(1.0) // default
	if cfg, err := s.referralRepo.GetConfig(models.ReferralConfigPointsPerUSD); err == nil {
		if v, err := decimal.NewFromString(cfg.Value); err == nil && v.IsPositive() {
			pointsPerUSD = v
		}
	}

	pointsEarned := volumeUSD.Mul(pointsPerUSD)
	if !pointsEarned.IsPositive() {
		return nil
	}

	ptx := &models.ReferralPointTransaction{
		ReferrerID:   referrerID,
		RefereeID:    refereeID,
		ReferralID:   ref.ID,
		P2POrderID:   orderID,
		VolumeUSD:    volumeUSD,
		PointsEarned: pointsEarned,
		Description:  fmt.Sprintf("Points from referee P2P order %s", orderID.String()),
	}

	if err := s.referralRepo.AddPointTransaction(ptx); err != nil {
		logger.Error("Failed to add referral point transaction",
			zap.String("referrer_id", referrerID.String()),
			zap.String("referee_id", refereeID.String()),
			zap.String("order_id", orderID.String()),
			zap.Error(err),
		)
		return err
	}

	logger.Info("Referral points awarded",
		zap.String("referrer_id", referrerID.String()),
		zap.String("referee_id", refereeID.String()),
		zap.String("order_id", orderID.String()),
		zap.String("points", pointsEarned.String()),
	)

	return nil
}

// ---------------------------------------------------------------------------
// Claims (user)
// ---------------------------------------------------------------------------

func (s *referralService) ClaimReward(userID uuid.UUID) (*models.ReferralClaim, error) {
	// Find open claim cycle.
	cycle, err := s.referralRepo.FindOpenClaimCycle()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.NewSafeError("no open claim cycle; claiming is not available right now")
		}
		return nil, err
	}

	// Get the quarter window for point summation.
	qStart, qEnd, err := quarterWindow(cycle.Quarter)
	if err != nil {
		return nil, err
	}

	// Sum user's points earned in this quarter.
	userPoints, err := s.referralRepo.SumPointsInWindow(userID, qStart, qEnd)
	if err != nil {
		return nil, err
	}
	if !userPoints.IsPositive() {
		return nil, utils.NewSafeError("no points earned in this cycle")
	}

	fiatAmount := userPoints.Mul(cycle.FiatPerPoint)
	if !fiatAmount.IsPositive() {
		return nil, utils.NewSafeError("calculated reward is zero")
	}

	now := time.Now().UTC()
	claim := &models.ReferralClaim{
		UserID:        userID,
		ClaimCycleID:  cycle.ID,
		PointsClaimed: userPoints,
		FiatAmount:    fiatAmount,
		Currency:      cycle.Currency,
		ClaimedAt:     now,
	}

	// Credit fiat wallet and create claim record atomically.
	if err := database.Transaction(func(tx *gorm.DB) error {
		// Re-check inside the transaction to close the race window.
		var existingClaim models.ReferralClaim
		if err := tx.Where("user_id = ? AND claim_cycle_id = ?", userID, cycle.ID).First(&existingClaim).Error; err == nil {
			return utils.NewSafeError("you have already claimed for this cycle")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if err := tx.Create(claim).Error; err != nil {
			return err
		}

		// Credit user's fiat wallet.
		var wallet models.Wallet
		if err := tx.Where("user_id = ? AND currency = ?", userID, cycle.Currency).First(&wallet).Error; err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			// Create fiat wallet if it doesn't exist.
			var cur models.Currency
			if err := tx.Where("symbol = ?", cycle.Currency).First(&cur).Error; err != nil {
				return fmt.Errorf("fiat currency %s not found", cycle.Currency)
			}
			wallet = models.Wallet{
				UserID:     userID,
				CurrencyID: cur.ID,
				Currency:   cycle.Currency,
			}
			if createErr := tx.Create(&wallet).Error; createErr != nil {
				if !utils.IsUniqueViolation(createErr) {
					return createErr
				}
				// Concurrent race: another goroutine created the wallet. Fetch it.
				if err := tx.Where("user_id = ? AND currency = ?", userID, cycle.Currency).First(&wallet).Error; err != nil {
					return err
				}
			}
		}

		// Atomically credit the wallet (handles both new and existing paths).
		referralDecimals, err := utils.CurrencyDecimalsFromDB(tx, cycle.Currency)
		if err != nil {
			return fmt.Errorf("failed to get currency decimals: %w", err)
		}
		referralUnits := utils.ToStorageUnits(fiatAmount, referralDecimals)
		if err := tx.Model(&models.Wallet{}).Where("id = ?", wallet.ID).
			Update("balance", gorm.Expr("balance + ?", referralUnits)).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", wallet.ID).First(&wallet).Error; err != nil {
			return err
		}
		referralBalanceAfter := utils.FromStorageUnits(wallet.Balance, referralDecimals)
		referralBalanceBefore := referralBalanceAfter.Sub(fiatAmount)

		wt := &models.WalletTransaction{
			WalletID:      wallet.ID,
			Type:          "referral_reward",
			Amount:        fiatAmount,
			BalanceBefore: referralBalanceBefore,
			BalanceAfter:  referralBalanceAfter,
			ReferenceID:   fmt.Sprintf("referral_claim:%s", claim.ID.String()),
			Description:   fmt.Sprintf("Referral reward claim for %s", cycle.Quarter),
		}
		if err := tx.Create(wt).Error; err != nil {
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}

	logger.Info("Referral reward claimed",
		zap.String("user_id", userID.String()),
		zap.String("cycle", cycle.Quarter),
		zap.String("fiat_amount", fiatAmount.String()),
		zap.String("currency", cycle.Currency),
	)

	return claim, nil
}

func (s *referralService) ListMyClaims(userID uuid.UUID, page, pageSize int) ([]models.ReferralClaimResponse, int64, error) {
	claims, total, err := s.referralRepo.ListClaimsByUser(userID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]models.ReferralClaimResponse, 0, len(claims))
	for _, c := range claims {
		quarter := ""
		if c.ClaimCycle != nil {
			quarter = c.ClaimCycle.Quarter
		}
		responses = append(responses, models.ReferralClaimResponse{
			ID:            c.ID,
			PointsClaimed: c.PointsClaimed,
			FiatAmount:    utils.TruncateIfFiat(c.FiatAmount, c.Currency),
			Currency:      c.Currency,
			Quarter:       quarter,
			ClaimedAt:     c.ClaimedAt.Format(time.RFC3339),
		})
	}

	return responses, total, nil
}

// ---------------------------------------------------------------------------
// Admin: referrals
// ---------------------------------------------------------------------------

func referralToAdminEntry(r models.Referral) AdminReferralEntry {
	entry := AdminReferralEntry{
		ID:        r.ID,
		ReferrerID: r.ReferrerID,
		RefereeID:  r.RefereeID,
		Status:    r.Status,
		CreatedAt: r.CreatedAt.Format(time.RFC3339),
	}
	if r.Referrer != nil {
		entry.ReferrerUID = r.Referrer.UID
		entry.ReferrerEmail = r.Referrer.Email
	}
	if r.Referee != nil {
		entry.RefereeUID = r.Referee.UID
		entry.RefereeUsername = r.Referee.Profile.Username
	}
	return entry
}

func (s *referralService) AdminListAllReferrals(page, pageSize int, status string) ([]AdminReferralEntry, int64, error) {
	refs, total, err := s.referralRepo.ListAllReferrals(page, pageSize, status)
	if err != nil {
		return nil, 0, err
	}
	entries := make([]AdminReferralEntry, 0, len(refs))
	for _, r := range refs {
		entries = append(entries, referralToAdminEntry(r))
	}
	return entries, total, nil
}

func (s *referralService) AdminListReferralsByUser(referrerID uuid.UUID, page, pageSize int) ([]AdminReferralEntry, int64, error) {
	refs, total, err := s.referralRepo.ListByReferrerIDAdmin(referrerID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	entries := make([]AdminReferralEntry, 0, len(refs))
	for _, r := range refs {
		entries = append(entries, referralToAdminEntry(r))
	}
	return entries, total, nil
}

// ---------------------------------------------------------------------------
// Admin: config
// ---------------------------------------------------------------------------

func (s *referralService) GetConfig(key string) (string, error) {
	cfg, err := s.referralRepo.GetConfig(key)
	if err != nil {
		return "", err
	}
	return cfg.Value, nil
}

func (s *referralService) UpdateConfig(key, value string) error {
	key = strings.TrimSpace(key)
	value = strings.TrimSpace(value)
	if key == "" || value == "" {
		return utils.NewSafeError("key and value are required")
	}

	// Validate specific keys.
	switch key {
	case models.ReferralConfigPointsPerUSD:
		v, err := decimal.NewFromString(value)
		if err != nil || !v.IsPositive() {
			return utils.NewSafeError("points_per_usd must be a positive number")
		}
	case models.ReferralConfigMinTradesEligibility:
		v, err := strconv.ParseInt(value, 10, 64)
		if err != nil || v < 0 {
			return utils.NewSafeError("min_trades_for_eligibility must be a non-negative integer")
		}
	}

	return s.referralRepo.UpsertConfig(key, value, "")
}

func (s *referralService) ListConfigs() ([]models.ReferralConfig, error) {
	return s.referralRepo.ListConfigs()
}

// ---------------------------------------------------------------------------
// Admin: claim cycles
// ---------------------------------------------------------------------------

func (s *referralService) OpenClaimCycle(quarter string, poolAmountFiat decimal.Decimal, currency string) (*models.ReferralClaimCycle, error) {
	quarter = strings.TrimSpace(quarter)
	currency = strings.ToUpper(strings.TrimSpace(currency))

	if quarter == "" || currency == "" {
		return nil, utils.NewSafeError("quarter and currency are required")
	}
	if !poolAmountFiat.IsPositive() {
		return nil, utils.NewSafeError("pool_amount_fiat must be positive")
	}

	// Validate quarter format.
	qStart, qEnd, err := quarterWindow(quarter)
	if err != nil {
		return nil, err
	}

	// Ensure no existing cycle for this quarter.
	if existing, err := s.referralRepo.FindClaimCycleByQuarter(quarter); err == nil && existing != nil {
		return nil, utils.NewSafeError(fmt.Sprintf("claim cycle for %s already exists", quarter))
	}

	// Ensure no other open cycle.
	if open, err := s.referralRepo.FindOpenClaimCycle(); err == nil && open != nil {
		return nil, utils.NewSafeError(fmt.Sprintf("there is already an open claim cycle (%s); close it first", open.Quarter))
	}

	// Snapshot total points earned in this quarter.
	totalPoints, err := s.referralRepo.SumAllPointsInWindow(qStart, qEnd)
	if err != nil {
		return nil, err
	}
	if !totalPoints.IsPositive() {
		return nil, utils.NewSafeError("no points were earned in this quarter; cannot open claim cycle")
	}

	fiatPerPoint := poolAmountFiat.Div(totalPoints)

	now := time.Now().UTC()
	cycle := &models.ReferralClaimCycle{
		Quarter:            quarter,
		PoolAmountFiat:     poolAmountFiat,
		Currency:           currency,
		TotalPointsInCycle: totalPoints,
		FiatPerPoint:       fiatPerPoint,
		Status:             models.ClaimCycleStatusOpen,
		OpenedAt:           &now,
	}

	if err := s.referralRepo.CreateClaimCycle(cycle); err != nil {
		return nil, err
	}

	logger.Info("Referral claim cycle opened",
		zap.String("quarter", quarter),
		zap.String("pool", poolAmountFiat.String()),
		zap.String("currency", currency),
		zap.String("fiat_per_point", fiatPerPoint.String()),
	)

	return cycle, nil
}

func (s *referralService) CloseClaimCycle(id uuid.UUID) error {
	return s.referralRepo.CloseClaimCycle(id)
}

func (s *referralService) ListClaimCycles() ([]models.ReferralClaimCycle, error) {
	return s.referralRepo.ListClaimCycles()
}
