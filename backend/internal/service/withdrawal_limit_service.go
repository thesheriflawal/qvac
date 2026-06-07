package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ErrDailyLimitExceeded is returned when a withdrawal would exceed the user's
// daily NGN withdrawal limit for their KYC tier.
var ErrDailyLimitExceeded = utils.NewSafeError("daily withdrawal limit exceeded for your KYC tier")

// Daily NGN limits per KYC tier (in Naira).
const (
	tier1DailyLimitNGN int64 = 1_500_000
	tier2DailyLimitNGN int64 = 7_500_000
	tier3DailyLimitNGN int64 = 15_000_000
)

// dailyLimitTTL is the Redis key TTL. 25 hours gives a safe buffer so the
// key never expires before midnight UTC has actually passed.
const dailyLimitTTL = 25 * time.Hour

// WithdrawalLimitService enforces per-user daily NGN withdrawal caps based on
// KYC tier, with optional per-user admin overrides.
type WithdrawalLimitService interface {
	// CheckAndRecord atomically checks whether amountNGN fits within the user's
	// remaining daily limit and, if so, records it. Returns ErrDailyLimitExceeded
	// if the withdrawal would exceed the cap. Fails closed if Redis is unavailable.
	CheckAndRecord(ctx context.Context, userID uuid.UUID, amountNGN decimal.Decimal) error

	// Release decrements the daily counter by amountNGN. Call this when a
	// withdrawal is definitively rejected (Nomba/Quidax 4xx) or Phase 1 fails,
	// so the headroom is restored for the user's next attempt.
	Release(ctx context.Context, userID uuid.UUID, amountNGN decimal.Decimal) error
}

type withdrawalLimitService struct {
	kycRepo   repository.KYCRepository
	limitRepo repository.WithdrawalLimitRepository
	redis     *cache.RedisClient
}

// NewWithdrawalLimitService creates a WithdrawalLimitService.
func NewWithdrawalLimitService(
	kycRepo repository.KYCRepository,
	limitRepo repository.WithdrawalLimitRepository,
	redis *cache.RedisClient,
) WithdrawalLimitService {
	return &withdrawalLimitService{
		kycRepo:   kycRepo,
		limitRepo: limitRepo,
		redis:     redis,
	}
}

func (s *withdrawalLimitService) CheckAndRecord(ctx context.Context, userID uuid.UUID, amountNGN decimal.Decimal) error {
	if s.redis == nil {
		return utils.NewSafeError("withdrawal limit service unavailable")
	}

	limitNGN, err := s.effectiveLimit(userID)
	if err != nil {
		return err
	}

	// Convert NGN amounts to kobo (integer) for atomic Redis INCRBY operations.
	limitKobo := limitNGN * 100
	amountKobo := amountNGN.Mul(decimal.NewFromInt(100)).IntPart()

	key := dailyKey(userID)
	_, ok, err := s.redis.CheckAndIncrWithLimit(key, limitKobo, amountKobo, dailyLimitTTL)
	if err != nil {
		return fmt.Errorf("withdrawal limit check unavailable: %w", err)
	}
	if !ok {
		return ErrDailyLimitExceeded
	}
	return nil
}

func (s *withdrawalLimitService) Release(ctx context.Context, userID uuid.UUID, amountNGN decimal.Decimal) error {
	if s.redis == nil {
		return nil
	}
	amountKobo := amountNGN.Mul(decimal.NewFromInt(100)).IntPart()
	return s.redis.DecrBy(dailyKey(userID), amountKobo)
}

// effectiveLimit returns the active daily NGN limit for a user — the admin
// override if one exists, otherwise the tier-based default.
func (s *withdrawalLimitService) effectiveLimit(userID uuid.UUID) (int64, error) {
	if s.limitRepo != nil {
		override, err := s.limitRepo.FindByUserID(userID)
		if err == nil && override != nil {
			return override.LimitNGN, nil
		}
		// gorm.ErrRecordNotFound means no override — fall through to tier default.
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, fmt.Errorf("could not load withdrawal limit override: %w", err)
		}
	}

	tier, err := s.kycRepo.GetCurrentTier(userID)
	if err != nil {
		return 0, fmt.Errorf("could not verify KYC tier: %w", err)
	}
	return limitForTier(tier)
}

// dailyKey returns the Redis key for a user's daily withdrawal counter.
// The date component is UTC so the window resets at midnight UTC.
func dailyKey(userID uuid.UUID) string {
	date := time.Now().UTC().Format("2006-01-02")
	return fmt.Sprintf("withdrawal:daily:%s:%s", userID.String(), date)
}

// limitForTier maps a KYC tier to its daily NGN withdrawal limit in Naira.
func limitForTier(tier models.KYCTier) (int64, error) {
	switch tier {
	case models.KYCTier1:
		return tier1DailyLimitNGN, nil
	case models.KYCTier2:
		return tier2DailyLimitNGN, nil
	case models.KYCTier3:
		return tier3DailyLimitNGN, nil
	default:
		return 0, utils.NewSafeError("no withdrawal limit configured for KYC tier")
	}
}
