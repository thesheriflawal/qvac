package service

import (
	"errors"
	"fmt"

	emailclient "github.com/Kynettic-org/kynettic-backend/internal/clients/email"
	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserService handles user management business logic
type UserService interface {
	GetByID(id uuid.UUID) (*models.User, error)
	GetByEmail(email string) (*models.User, error)
	GetByUID(uid string) (*models.User, error)
	Update(id uuid.UUID) (*models.User, error)
	Delete(id uuid.UUID) error
	List(page, pageSize int) ([]models.User, int64, error)
	ChangePassword(id uuid.UUID, currentPassword, newPassword string) error
	// RequestEmailChangeOTP sends a verification OTP to newEmail. The OTP must be
	// confirmed via ConfirmEmailChange before the address is updated in the database.
	RequestEmailChangeOTP(userID uuid.UUID, newEmail string) error
	// ConfirmEmailChange verifies the OTP and updates the user's email address.
	ConfirmEmailChange(userID uuid.UUID, otp string) error
}

type userService struct {
	userRepo repository.UserRepository
	email    emailclient.Sender
	config   *config.Config
}

// NewUserService creates a new user service
func NewUserService(userRepo repository.UserRepository, emailSender emailclient.Sender, cfg *config.Config) UserService {
	return &userService{
		userRepo: userRepo,
		email:    emailSender,
		config:   cfg,
	}
}

// GetByID retrieves a user by ID
func (s *userService) GetByID(id uuid.UUID) (*models.User, error) {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.NewSafeError("user not found")
		}
		return nil, err
	}
	return user, nil
}

// GetByEmail retrieves a user by email
func (s *userService) GetByEmail(email string) (*models.User, error) {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.NewSafeError("user not found")
		}
		return nil, err
	}
	return user, nil
}

// GetByUID retrieves a user by UID
func (s *userService) GetByUID(uid string) (*models.User, error) {
	user, err := s.userRepo.FindByUID(uid)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.NewSafeError("user not found")
		}
		return nil, err
	}
	return user, nil
}

// Update updates a user's display name fields. Email changes require OTP
// verification via RequestEmailChangeOTP / ConfirmEmailChange.
func (s *userService) Update(id uuid.UUID) (*models.User, error) {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.NewSafeError("user not found")
		}
		return nil, err
	}

	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}

	return user, nil
}

// RequestEmailChangeOTP sends a 6-digit OTP to newEmail. The caller must then
// call ConfirmEmailChange with the OTP to commit the address update.
func (s *userService) RequestEmailChangeOTP(userID uuid.UUID, newEmail string) error {
	newEmail = utils.NormalizeEmail(newEmail)
	if newEmail == "" {
		return utils.NewSafeError("email is required")
	}

	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return utils.NewSafeError("user not found")
	}
	if newEmail == user.Email {
		return utils.NewSafeError("new email must be different from current email")
	}

	exists, err := s.userRepo.ExistsByEmail(newEmail)
	if err != nil {
		return err
	}
	if exists {
		// Do not reveal that this email is already registered — doing so allows
		// an authenticated attacker to enumerate other users' addresses. Instead,
		// silently send a security notice to the existing owner and return a
		// generic success so the response is indistinguishable from a valid OTP send.
		if s.email != nil {
			subject := "Suspicious account activity"
			html := emailclient.AlreadyRegisteredEmailHTML(s.config.App.Name)
			go func() { _ = s.email.SendOTP(newEmail, subject, html) }()
		}
		return nil
	}

	otp, err := utils.Generate6DigitOTP()
	if err != nil {
		return err
	}

	if err := s.storeEmailChangeOTP(userID, newEmail, otp); err != nil {
		return err
	}

	if s.email == nil {
		return utils.NewSafeError("email sender not configured")
	}

	subject := "Verify your new email address"
	html := emailclient.EmailVerificationHTML("", otp)
	return s.email.SendOTP(newEmail, subject, html)
}

// ConfirmEmailChange verifies the OTP previously sent to the new email and
// commits the address update. Returns an error if the OTP is invalid/expired
// or if the email was claimed by another account in the meantime.
func (s *userService) ConfirmEmailChange(userID uuid.UUID, otp string) error {
	newEmail, err := s.verifyEmailChangeOTP(userID, otp)
	if err != nil {
		return err
	}

	// Re-check uniqueness at confirmation time to guard against a race where
	// another account registered the same address while the OTP was pending.
	exists, err := s.userRepo.ExistsByEmail(newEmail)
	if err != nil {
		return err
	}
	if exists {
		return utils.NewSafeError("email is no longer available")
	}

	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return utils.NewSafeError("user not found")
	}

	user.Email = newEmail
	return s.userRepo.Update(user)
}

// Delete permanently removes a user's personal data and soft-deletes the account
// record. It follows the Google Play Store data deletion policy:
//
//  1. A confirmation email is sent to the user's current address before any data
//     is wiped, so they have a record of the request.
//  2. All personally-identifiable fields (email, name) are overwritten with
//     anonymised values so the soft-deleted row contains no recoverable PII.
//  3. All active sessions are invalidated in Redis, revoking any live tokens.
//  4. Financial records (transactions, wallets, orders) are retained to satisfy
//     legal and regulatory obligations but are dissociated from real identity.
func (s *userService) Delete(id uuid.UUID) error {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.NewSafeError("user not found")
		}
		return err
	}

	// Send deletion confirmation email before anonymising the address.
	if s.email != nil {
		retentionNote := "Transaction history, order records, and wallet activity are retained " +
			"for up to 7 years to comply with anti-money-laundering and financial regulations."
		html := emailclient.AccountDeletionEmailHTML(s.config.App.Name, retentionNote)
		go func() { _ = s.email.SendOTP(user.Email, "Your account has been deleted", html) }()
	}

	// Anonymise PII so the soft-deleted row cannot be used to identify the user.
	anonymisedEmail := fmt.Sprintf("deleted_%s@deleted.invalid", id.String())
	user.Email = anonymisedEmail
	user.FirstName = ""
	user.LastName = ""
	user.IsActive = false
	if err := s.userRepo.Update(user); err != nil {
		return err
	}

	// Invalidate all active sessions (web + mobile) so any live tokens are revoked.
	if cache.Client != nil {
		for _, dt := range []string{"web", "mobile"} {
			_ = cache.Client.Delete(fmt.Sprintf("session:%s:%s", id.String(), dt))
		}
	}

	return s.userRepo.Delete(user.ID)
}

// List returns a paginated list of users
func (s *userService) List(page, pageSize int) ([]models.User, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}

	return s.userRepo.List(page, pageSize)
}

// ChangePassword changes a user's password
func (s *userService) ChangePassword(id uuid.UUID, oldPassword, newPassword string) error {
	user, err := s.userRepo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.NewSafeError("user not found")
		}
		return err
	}

	// Verify old password
	if err := utils.ComparePassword(user.Password, oldPassword); err != nil {
		return utils.NewSafeError("invalid old password")
	}

	// Validate new password strength
	if !utils.ValidatePasswordStrength(newPassword) {
		return utils.NewSafeError("password must be at least 12 characters and include uppercase, lowercase, digit, and a symbol from !@#$%^&*")
	}

	// Update password (will be hashed by BeforeUpdate hook)
	user.Password = newPassword
	if err := s.userRepo.Update(user); err != nil {
		return err
	}

	// Invalidate all active sessions so any stolen tokens are revoked.
	if cache.Client != nil {
		for _, dt := range []string{"web", "mobile"} {
			_ = cache.Client.Delete(fmt.Sprintf("session:%s:%s", id.String(), dt))
		}
	}
	return nil
}
