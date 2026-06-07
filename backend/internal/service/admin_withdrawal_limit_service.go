package service

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserLimitInfo is the response payload for the admin withdrawal limit endpoint.
type UserLimitInfo struct {
	Tier             models.KYCTier `json:"tier"`
	TierLimitNGN     int64          `json:"tier_limit_ngn"`
	OverrideLimitNGN *int64         `json:"override_limit_ngn"` // null when no override
	EffectiveLimitNGN int64         `json:"effective_limit_ngn"`
	TodayUsageNGN    int64          `json:"today_usage_ngn"`
	RemainingNGN     int64          `json:"remaining_ngn"`
}

// AdminWithdrawalLimitService provides admin-level visibility and control over
// per-user daily withdrawal limits.
type AdminWithdrawalLimitService interface {
	// GetUserLimit returns the tier limit, any admin override, today's usage,
	// and remaining headroom for the given user.
	GetUserLimit(userID uuid.UUID) (*UserLimitInfo, error)

	// SetOverride creates or replaces the permanent custom daily limit for a user.
	SetOverride(userID, adminID uuid.UUID, limitNGN int64) error

	// RemoveOverride deletes the custom limit, reverting the user to their tier default.
	RemoveOverride(userID uuid.UUID) error
}

type adminWithdrawalLimitService struct {
	kycRepo   repository.KYCRepository
	limitRepo repository.WithdrawalLimitRepository
	redis     *cache.RedisClient
}

// NewAdminWithdrawalLimitService creates an AdminWithdrawalLimitService.
func NewAdminWithdrawalLimitService(
	kycRepo repository.KYCRepository,
	limitRepo repository.WithdrawalLimitRepository,
	redis *cache.RedisClient,
) AdminWithdrawalLimitService {
	return &adminWithdrawalLimitService{
		kycRepo:   kycRepo,
		limitRepo: limitRepo,
		redis:     redis,
	}
}

func (s *adminWithdrawalLimitService) GetUserLimit(userID uuid.UUID) (*UserLimitInfo, error) {
	tier, err := s.kycRepo.GetCurrentTier(userID)
	if err != nil {
		return nil, fmt.Errorf("could not fetch KYC tier: %w", err)
	}

	tierLimit, _ := limitForTier(tier)

	info := &UserLimitInfo{
		Tier:         tier,
		TierLimitNGN: tierLimit,
	}

	// Check for admin override.
	override, err := s.limitRepo.FindByUserID(userID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("could not fetch limit override: %w", err)
	}
	if err == nil && override != nil {
		info.OverrideLimitNGN = &override.LimitNGN
		info.EffectiveLimitNGN = override.LimitNGN
	} else {
		info.EffectiveLimitNGN = tierLimit
	}

	// Read today's usage from Redis (value stored in kobo).
	info.TodayUsageNGN = s.todayUsageNGN(userID)
	info.RemainingNGN = info.EffectiveLimitNGN - info.TodayUsageNGN
	if info.RemainingNGN < 0 {
		info.RemainingNGN = 0
	}

	return info, nil
}

func (s *adminWithdrawalLimitService) SetOverride(userID, adminID uuid.UUID, limitNGN int64) error {
	if limitNGN <= 0 {
		return utils.NewSafeError("limit_ngn must be greater than zero")
	}
	return s.limitRepo.Upsert(&models.WithdrawalLimitOverride{
		UserID:   userID,
		LimitNGN: limitNGN,
		SetByID:  adminID,
	})
}

func (s *adminWithdrawalLimitService) RemoveOverride(userID uuid.UUID) error {
	return s.limitRepo.DeleteByUserID(userID)
}

// todayUsageNGN reads the Redis daily counter and converts kobo → Naira.
// Returns 0 if Redis is unavailable or the key does not exist yet.
func (s *adminWithdrawalLimitService) todayUsageNGN(userID uuid.UUID) int64 {
	if s.redis == nil {
		return 0
	}
	key := fmt.Sprintf("withdrawal:daily:%s:%s", userID.String(), time.Now().UTC().Format("2006-01-02"))
	val, err := s.redis.Get(key)
	if err != nil {
		return 0
	}
	kobo, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return 0
	}
	return kobo / 100
}
