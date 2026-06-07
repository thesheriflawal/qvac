package service

import (
	"errors"
	"fmt"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AdminUserDetail bundles all data shown on the admin user detail page.
type AdminUserDetail struct {
	User      *models.User
	KYC       *models.KYCVerification // nil if the user has never started KYC
	RecentTxs []models.WalletTransaction
	TxTotal   int64
}

// AdminUserService provides admin-only user management operations.
type AdminUserService interface {
	SearchUsers(filters repository.AdminUserFilters, page, pageSize int) ([]models.User, int64, error)
	GetUserDetail(id uuid.UUID) (*AdminUserDetail, error)
	SetActiveStatus(id uuid.UUID, isActive bool) error
}

type adminUserService struct {
	userRepo   repository.UserRepository
	kycRepo    repository.KYCRepository
	walletRepo repository.WalletRepository
}

// NewAdminUserService creates a new AdminUserService.
func NewAdminUserService(
	userRepo repository.UserRepository,
	kycRepo repository.KYCRepository,
	walletRepo repository.WalletRepository,
) AdminUserService {
	return &adminUserService{
		userRepo:   userRepo,
		kycRepo:    kycRepo,
		walletRepo: walletRepo,
	}
}

func (s *adminUserService) SearchUsers(filters repository.AdminUserFilters, page, pageSize int) ([]models.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}
	return s.userRepo.SearchUsers(filters, page, pageSize)
}

func (s *adminUserService) GetUserDetail(id uuid.UUID) (*AdminUserDetail, error) {
	user, err := s.userRepo.FindByIDWithAdminDetail(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.NewSafeError("user not found")
		}
		return nil, err
	}

	// KYC is optional — a user may not have started verification yet.
	kyc, err := s.kycRepo.FindByUserID(id)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	txs, total, err := s.walletRepo.ListTransactionsByUser(id, "", 1, 10)
	if err != nil {
		return nil, err
	}

	return &AdminUserDetail{
		User:      user,
		KYC:       kyc,
		RecentTxs: txs,
		TxTotal:   total,
	}, nil
}

func (s *adminUserService) SetActiveStatus(id uuid.UUID, isActive bool) error {
	if err := s.userRepo.SetActiveStatus(id, isActive); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.NewSafeError("user not found")
		}
		return err
	}

	// Immediately invalidate the user's sessions when deactivating so they
	// cannot continue using existing tokens until re-activated.
	if !isActive && cache.Client != nil {
		for _, dt := range []string{"web", "mobile"} {
			_ = cache.Client.Delete(fmt.Sprintf("session:%s:%s", id.String(), dt))
		}
	}

	return nil
}
