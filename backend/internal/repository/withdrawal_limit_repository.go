package repository

import (
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// WithdrawalLimitRepository manages per-user withdrawal limit overrides.
type WithdrawalLimitRepository interface {
	FindByUserID(userID uuid.UUID) (*models.WithdrawalLimitOverride, error)
	Upsert(override *models.WithdrawalLimitOverride) error
	DeleteByUserID(userID uuid.UUID) error
}

type withdrawalLimitRepository struct {
	db *gorm.DB
}

// NewWithdrawalLimitRepository creates a new WithdrawalLimitRepository.
func NewWithdrawalLimitRepository(db *gorm.DB) WithdrawalLimitRepository {
	return &withdrawalLimitRepository{db: db}
}

func (r *withdrawalLimitRepository) FindByUserID(userID uuid.UUID) (*models.WithdrawalLimitOverride, error) {
	var override models.WithdrawalLimitOverride
	err := r.db.Where("user_id = ?", userID).First(&override).Error
	if err != nil {
		return nil, err
	}
	return &override, nil
}

// Upsert creates a new override or updates the limit and set_by fields if one
// already exists for the user.
func (r *withdrawalLimitRepository) Upsert(override *models.WithdrawalLimitOverride) error {
	var existing models.WithdrawalLimitOverride
	err := r.db.Where("user_id = ?", override.UserID).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return r.db.Create(override).Error
	}
	if err != nil {
		return err
	}
	existing.LimitNGN = override.LimitNGN
	existing.SetByID = override.SetByID
	return r.db.Save(&existing).Error
}

func (r *withdrawalLimitRepository) DeleteByUserID(userID uuid.UUID) error {
	return r.db.Unscoped().Where("user_id = ?", userID).Delete(&models.WithdrawalLimitOverride{}).Error
}
