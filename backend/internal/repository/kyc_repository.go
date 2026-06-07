package repository

import (
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// KYCListFilters holds optional filter criteria for admin KYC listing.
type KYCListFilters struct {
	Status *models.KYCStatus
	Tier   *models.KYCTier
}

// KYCRepository handles KYC verification data operations
type KYCRepository interface {
	Create(kyc *models.KYCVerification) error
	FindByUserID(userID uuid.UUID) (*models.KYCVerification, error)
	FindByBVNBlindIndex(blindIndex string) (*models.KYCVerification, error)
	FindByNINBlindIndex(blindIndex string) (*models.KYCVerification, error)
	Update(kyc *models.KYCVerification) error
	GetCurrentTier(userID uuid.UUID) (models.KYCTier, error)
	// Admin-specific methods
	ListVerifications(filters KYCListFilters, page, pageSize int) ([]models.KYCVerification, int64, error)
}

type kycRepository struct {
	db *gorm.DB
}

// NewKYCRepository creates a new KYC repository
func NewKYCRepository(db *gorm.DB) KYCRepository {
	return &kycRepository{db: db}
}

// Create creates a new KYC verification record
func (r *kycRepository) Create(kyc *models.KYCVerification) error {
	return r.db.Create(kyc).Error
}

// FindByUserID finds a KYC verification record by user ID
func (r *kycRepository) FindByUserID(userID uuid.UUID) (*models.KYCVerification, error) {
	var kyc models.KYCVerification
	err := r.db.Where("user_id = ?", userID).First(&kyc).Error
	if err != nil {
		return nil, err
	}
	return &kyc, nil
}

// FindByBVNBlindIndex finds a KYC record by BVN blind index
func (r *kycRepository) FindByBVNBlindIndex(blindIndex string) (*models.KYCVerification, error) {
	var kyc models.KYCVerification
	err := r.db.Where("bvn_blind_index = ?", blindIndex).First(&kyc).Error
	if err != nil {
		return nil, err
	}
	return &kyc, nil
}

// FindByNINBlindIndex finds a KYC record by NIN blind index
func (r *kycRepository) FindByNINBlindIndex(blindIndex string) (*models.KYCVerification, error) {
	var kyc models.KYCVerification
	err := r.db.Where("nin_blind_index = ?", blindIndex).First(&kyc).Error
	if err != nil {
		return nil, err
	}
	return &kyc, nil
}

// Update updates a KYC verification record
func (r *kycRepository) Update(kyc *models.KYCVerification) error {
	return r.db.Save(kyc).Error
}

// GetCurrentTier returns the current KYC tier for a user
func (r *kycRepository) GetCurrentTier(userID uuid.UUID) (models.KYCTier, error) {
	var kyc models.KYCVerification
	err := r.db.Select("tier").Where("user_id = ?", userID).First(&kyc).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return models.KYCTierNone, nil
		}
		return models.KYCTierNone, err
	}
	return kyc.Tier, nil
}

// ListVerifications returns paginated KYC records with their user preloaded.
func (r *kycRepository) ListVerifications(filters KYCListFilters, page, pageSize int) ([]models.KYCVerification, int64, error) {
	var records []models.KYCVerification
	var total int64

	q := r.db.Model(&models.KYCVerification{})

	if filters.Status != nil {
		q = q.Where("status = ?", *filters.Status)
	}
	if filters.Tier != nil {
		q = q.Where("tier = ?", *filters.Tier)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Preload("User").Preload("User.Profile").
		Order("updated_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&records).Error; err != nil {
		return nil, 0, err
	}

	return records, total, nil
}
