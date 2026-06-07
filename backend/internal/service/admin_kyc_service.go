package service

import (
	"errors"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)


// AdminKYCService provides admin-only KYC visibility operations.
type AdminKYCService interface {
	ListVerifications(filters repository.KYCListFilters, page, pageSize int) ([]models.KYCVerification, int64, error)
	GetVerification(userID uuid.UUID) (*models.KYCVerification, error)
}

type adminKYCService struct {
	kycRepo repository.KYCRepository
}

// NewAdminKYCService creates a new AdminKYCService.
func NewAdminKYCService(kycRepo repository.KYCRepository) AdminKYCService {
	return &adminKYCService{kycRepo: kycRepo}
}

func (s *adminKYCService) ListVerifications(filters repository.KYCListFilters, page, pageSize int) ([]models.KYCVerification, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}
	return s.kycRepo.ListVerifications(filters, page, pageSize)
}

func (s *adminKYCService) GetVerification(userID uuid.UUID) (*models.KYCVerification, error) {
	kyc, err := s.kycRepo.FindByUserID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.NewSafeError("KYC record not found")
		}
		return nil, err
	}
	return kyc, nil
}

