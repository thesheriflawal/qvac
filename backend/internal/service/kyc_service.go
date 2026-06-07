package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Tier1Request represents the request for Tier 1 KYC verification (BVN)
type Tier1Request struct {
	FirstName            string `json:"first_name" validate:"required,min=2,max=100"`
	LastName             string `json:"last_name" validate:"required,min=2,max=100"`
	Username             string `json:"username" validate:"required,min=3,max=50"`
	DisplayUsernameOnP2P bool   `json:"display_username_on_p2p"`
	DateOfBirth          string `json:"date_of_birth" validate:"required"` // Format: YYYY-MM-DD
	PhoneNumber          string `json:"phone_number" validate:"required,min=10,max=20"`
	BVN                  string `json:"bvn" validate:"required,len=11"`
}

// Tier2Request represents the request for Tier 2 KYC verification (NIN)
type Tier2Request struct {
	NIN string `json:"nin" validate:"required,len=11"`
}

// Tier3Request represents the request for Tier 3 KYC verification
type Tier3Request struct {
	NIN            string `json:"nin" validate:"required"`
	SelfieBase64   string `json:"selfie_base64" validate:"required"`
	UtilityBillURL string `json:"utility_bill_url" validate:"required,url"`
	AddressStreet  string `json:"address_street" validate:"required,max=255"`
	AddressCity    string `json:"address_city" validate:"required,max=100"`
	AddressState   string `json:"address_state" validate:"required,max=100"`
	AddressCountry string `json:"address_country" validate:"required,max=100"`
}

// KYCService handles KYC verification business logic
type KYCService interface {
	GetKYCStatus(userID uuid.UUID) (*models.KYCStatusResponse, error)
	SubmitTier1(ctx context.Context, userID uuid.UUID, req *Tier1Request) error
	SubmitTier2(ctx context.Context, userID uuid.UUID, req *Tier2Request) error
	SubmitTier3(ctx context.Context, userID uuid.UUID, req *Tier3Request) error
}

type kycService struct {
	kycRepo  repository.KYCRepository
	userRepo repository.UserRepository
	db       *gorm.DB
	cfg      *config.Config
}

// NewKYCService creates a new KYC service
func NewKYCService(
	kycRepo repository.KYCRepository,
	userRepo repository.UserRepository,
	cfg *config.Config,
	db *gorm.DB,
) KYCService {
	return &kycService{
		kycRepo:  kycRepo,
		userRepo: userRepo,
		db:       db,
		cfg:      cfg,
	}
}

// GetKYCStatus returns the current KYC status for a user
func (s *kycService) GetKYCStatus(userID uuid.UUID) (*models.KYCStatusResponse, error) {
	kyc, err := s.kycRepo.FindByUserID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &models.KYCStatusResponse{
				Tier:            models.KYCTierNone,
				Status:          models.KYCStatusPending,
				BVNVerified:     false,
				NINVerified:     false,
				SelfieVerified:  false,
				AddressVerified: false,
				NextTier:        models.KYCTier1,
			}, nil
		}
		return nil, err
	}
	return kyc.ToStatusResponse(), nil
}

// SubmitTier1 processes Tier 1 KYC verification
func (s *kycService) SubmitTier1(ctx context.Context, userID uuid.UUID, req *Tier1Request) error {
	existingKYC, err := s.kycRepo.FindByUserID(userID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if existingKYC != nil && existingKYC.Tier >= models.KYCTier1 {
		return utils.NewSafeError("tier 1 verification already completed")
	}

	dob, err := time.Parse("2006-01-02", req.DateOfBirth)
	if err != nil {
		return utils.NewSafeError("invalid date of birth format, expected YYYY-MM-DD")
	}

	if err := s.validateIdentityNumber(models.IdentityTypeBVN, req.BVN); err != nil {
		return err
	}

	bvnBlindIndex := utils.KYCBlindIndex(s.cfg.App.KYCBlindIndexKey, req.BVN)
	existing, err := s.kycRepo.FindByBVNBlindIndex(bvnBlindIndex)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if existing != nil && existing.UserID != userID {
		return utils.NewSafeError("this BVN is already associated with another account")
	}

	// Minimum age check from submitted date of birth (no external BVN lookup).
	if err := checkMinimumAge(req.DateOfBirth); err != nil {
		return err
	}

	now := time.Now()

	return s.db.Transaction(func(tx *gorm.DB) error {
		user, err := s.userRepo.FindByID(userID)
		if err != nil {
			return err
		}

		user.FirstName = req.FirstName
		user.LastName = req.LastName

		if err := tx.Save(user).Error; err != nil {
			return err
		}

		var profile models.UserProfile
		if err := tx.Where("user_id = ?", userID).First(&profile).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				profile = models.UserProfile{UserID: userID}
			} else {
				return err
			}
		}

		profile.FirstName = req.FirstName
		profile.LastName = req.LastName
		profile.Username = req.Username
		profile.DateOfBirth = &dob
		profile.PhoneNumber = req.PhoneNumber
		profile.DisplayUsernameOnP2P = req.DisplayUsernameOnP2P

		if err := tx.Save(&profile).Error; err != nil {
			return err
		}

		kyc := existingKYC
		if kyc == nil {
			kyc = &models.KYCVerification{UserID: userID}
		}

		kyc.Tier = models.KYCTier1
		kyc.Status = models.KYCStatusVerified

		encBVN, err := utils.EncryptAES(req.BVN, s.cfg.App.KYCEncryptionKey)
		if err != nil {
			return err
		}
		kyc.BVN = encBVN
		kyc.BVNBlindIndex = &bvnBlindIndex
		kyc.BVNVerifiedAt = &now

		if existingKYC == nil {
			return tx.Create(kyc).Error
		}
		return tx.Save(kyc).Error
	})
}

// SubmitTier2 processes Tier 2 KYC verification (stores NIN; no external lookup)
func (s *kycService) SubmitTier2(ctx context.Context, userID uuid.UUID, req *Tier2Request) error {
	kyc, err := s.kycRepo.FindByUserID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.NewSafeError("tier 1 verification must be completed first")
		}
		return err
	}

	if kyc.Tier < models.KYCTier1 {
		return utils.NewSafeError("tier 1 verification must be completed first")
	}
	if kyc.Tier >= models.KYCTier2 {
		return utils.NewSafeError("tier 2 verification already completed")
	}

	if err := s.validateIdentityNumber(models.IdentityTypeNIN, req.NIN); err != nil {
		return err
	}

	ninBlindIndex := utils.KYCBlindIndex(s.cfg.App.KYCBlindIndexKey, req.NIN)
	existingNIN, err := s.kycRepo.FindByNINBlindIndex(ninBlindIndex)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if existingNIN != nil && existingNIN.UserID != userID {
		return utils.NewSafeError("this NIN is already associated with another account")
	}

	now := time.Now()

	encNIN, err := utils.EncryptAES(req.NIN, s.cfg.App.KYCEncryptionKey)
	if err != nil {
		return err
	}
	kyc.NIN = encNIN
	kyc.NINBlindIndex = &ninBlindIndex
	kyc.NINVerifiedAt = &now
	kyc.Tier = models.KYCTier2
	kyc.Status = models.KYCStatusVerified

	return s.kycRepo.Update(kyc)
}

// SubmitTier3 processes Tier 3 KYC verification (stores address; no external selfie/liveness check)
func (s *kycService) SubmitTier3(ctx context.Context, userID uuid.UUID, req *Tier3Request) error {
	kyc, err := s.kycRepo.FindByUserID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.NewSafeError("tier 2 verification must be completed first")
		}
		return err
	}

	if kyc.Tier < models.KYCTier2 {
		return utils.NewSafeError("tier 2 verification must be completed first")
	}
	if kyc.Tier >= models.KYCTier3 {
		return utils.NewSafeError("tier 3 verification already completed")
	}

	if err := s.validateIdentityNumber(models.IdentityTypeNIN, req.NIN); err != nil {
		return err
	}

	now := time.Now()

	kyc.Tier = models.KYCTier3
	kyc.Status = models.KYCStatusVerified
	kyc.SelfieVerifiedAt = &now
	kyc.AddressStreet = req.AddressStreet
	kyc.AddressCity = req.AddressCity
	kyc.AddressState = req.AddressState
	kyc.AddressCountry = req.AddressCountry
	kyc.AddressVerifiedAt = &now

	return s.kycRepo.Update(kyc)
}

// namesMatch compares two names case-insensitively after trimming whitespace.
func namesMatch(submitted, official string) bool {
	return strings.EqualFold(strings.TrimSpace(submitted), strings.TrimSpace(official))
}

// checkMinimumAge returns an error if the date of birth (YYYY-MM-DD) indicates
// the person is younger than 18 years old.
func checkMinimumAge(dateOfBirth string) error {
	dob, err := time.Parse("2006-01-02", dateOfBirth)
	if err != nil {
		return utils.NewSafeError("invalid date of birth format, expected YYYY-MM-DD")
	}
	now := time.Now()
	age := now.Year() - dob.Year()
	if now.Month() < dob.Month() || (now.Month() == dob.Month() && now.Day() < dob.Day()) {
		age--
	}
	if age < 18 {
		return utils.NewSafeError("user must be at least 18 years old to complete verification")
	}
	return nil
}

// validateIdentityNumber validates the format of BVN or NIN
func (s *kycService) validateIdentityNumber(identityType models.IdentityType, number string) error {
	number = strings.TrimSpace(number)

	switch identityType {
	case models.IdentityTypeBVN:
		if len(number) != 11 {
			return utils.NewSafeError("BVN must be exactly 11 digits")
		}
		for _, c := range number {
			if c < '0' || c > '9' {
				return utils.NewSafeError("BVN must contain only digits")
			}
		}
	case models.IdentityTypeNIN:
		if len(number) != 11 {
			return utils.NewSafeError("NIN must be exactly 11 digits")
		}
		for _, c := range number {
			if c < '0' || c > '9' {
				return utils.NewSafeError("NIN must contain only digits")
			}
		}
	default:
		return utils.NewSafeError("invalid identity type")
	}

	return nil
}
