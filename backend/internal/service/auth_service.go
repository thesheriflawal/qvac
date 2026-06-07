package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	emailclient "github.com/Kynettic-org/kynettic-backend/internal/clients/email"
	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	oauth "github.com/Kynettic-org/kynettic-backend/internal/oauth"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ErrTwoFARequired is returned when login succeeds but 2FA verification is needed.
var ErrTwoFARequired = utils.NewSafeError("2FA verification required")

// preAuthTokenTTL is the lifetime of a pre-authentication token issued to
// 2FA-enabled users after password verification.
const preAuthTokenTTL = 5 * time.Minute

// preAuthTokenUsedKey returns the Redis key used to mark a pre_auth token as
// consumed. The JTI (JWT ID) is a random UUID embedded in the token claims.
func preAuthTokenUsedKey(jti string) string {
	return "auth:preauth:used:" + jti
}

// LoginResult is returned by Login. Exactly one of the two cases is populated:
//   - No 2FA: AccessToken, RefreshToken, and User are set.
//   - 2FA required: PreAuthToken is set; the other fields are empty/nil.
type LoginResult struct {
	AccessToken  string
	RefreshToken string
	User         *models.User
	PreAuthToken string // short-lived, restricted JWT; non-empty only when 2FA is required
}

// AuthService handles authentication business logic
type AuthService interface {
	RequestRegistrationOTP(email string) error
	VerifyRegistrationOTP(email, otp string) (registrationToken string, err error)
	SetPassword(registrationToken, password, referralCode string) (*models.User, error)

	RequestPasswordResetOTP(email string) error
	VerifyPasswordResetOTP(email, otp string) (resetToken string, err error)
	ResetPassword(resetToken, newPassword string) error

	// Login validates email+password. clientIP is used to scope the failed-attempt
	// counter so that an attacker cannot lock out a victim by sending deliberate failures.
	// If 2FA is not enabled the result contains full tokens. If 2FA is required it
	// contains a short-lived PreAuthToken that must be exchanged via VerifyTwoFA.
	Login(email, password, deviceType, clientIP string) (*LoginResult, error)
	// VerifyTwoFA exchanges a pre_auth token + TOTP code for full session tokens.
	VerifyTwoFA(preAuthToken, totpCode string) (string, string, *models.User, error)
	// LoginWith2FA is the legacy single-step 2FA login (email+password+code).
	LoginWith2FA(email, password, totpCode, deviceType, clientIP string) (string, string, *models.User, error)
	RefreshToken(refreshToken string) (string, error)
	Logout(userID uuid.UUID, deviceType string) error

	LoginWithGoogle(ctx context.Context, idToken, nonce, deviceType, referralCode string) (string, string, *models.User, error)
	LoginWithApple(ctx context.Context, idToken, nonce, deviceType, referralCode string) (string, string, *models.User, error)
}

type authService struct {
	userRepo        repository.UserRepository
	config          *config.Config
	email           emailclient.Sender
	referralService ReferralService
}

const (
	loginFailedAttemptsTTL   = 15 * time.Minute
	loginMaxFailedAttempts   = 5  // per-email threshold
	loginMaxIPFailedAttempts = 20 // per-IP threshold (volumetric guard)
	loginLockoutMessage      = "too many failed login attempts; please try again later"
	loginLockoutGenericError = "invalid email or password"
)

// loginAttemptsKey returns the Redis key for the per-email failed-login counter.
// Keying solely on the (normalised) email means lockout is enforced regardless
// of which IP the attacker rotates to — IP rotation can no longer bypass it.
func loginAttemptsKey(email string) string {
	return fmt.Sprintf("auth:login:attempts:email:%s", utils.NormalizeEmail(email))
}

// loginIPAttemptsKey returns the Redis key for the per-IP failed-login counter.
// This is a secondary, higher-threshold guard against volumetric credential
// stuffing where a single IP hammers many different accounts.
func loginIPAttemptsKey(clientIP string) string {
	return fmt.Sprintf("auth:login:attempts:ip:%s", clientIP)
}

func sessionKey(userID uuid.UUID, deviceType string) string {
	return fmt.Sprintf("session:%s:%s", userID.String(), deviceType)
}

// NewAuthService creates a new auth service
func NewAuthService(userRepo repository.UserRepository, cfg *config.Config, emailSender emailclient.Sender, referralService ReferralService) AuthService {
	return &authService{
		userRepo:        userRepo,
		config:          cfg,
		email:           emailSender,
		referralService: referralService,
	}
}

// RequestRegistrationOTP generates and sends a 6-digit OTP (valid for 10 minutes).
//
// Current implementation stores OTP state in Redis and logs the OTP in non-production
// environments (until SMTP is configured).
func (s *authService) RequestRegistrationOTP(email string) error {
	email = utils.NormalizeEmail(email)

	// Disallow OTP for existing users, but don't reveal account existence to
	// the caller. Instead, send a notification to the address so the real
	// owner is aware, and return the same response as a normal OTP send.
	exists, err := s.userRepo.ExistsByEmail(email)
	if err != nil {
		return err
	}
	if exists {
		if s.email != nil {
			subject := "Account already registered"
			html := emailclient.AlreadyRegisteredEmailHTML(s.config.App.Name)
			go func() {
				if err := s.email.SendOTP(email, subject, html); err != nil {
					logger.Warn("Failed to send already-registered notification",
						zap.String("email", email),
						zap.Error(err),
					)
				}
			}()
		}
		return nil
	}

	otp, err := utils.Generate6DigitOTP()
	if err != nil {
		return err
	}

	if err := s.storeRegistrationOTP(email, otp); err != nil {
		return err
	}

	if s.email == nil {
		return utils.NewSafeError("email sender not configured")
	}

	subject := "Your Kynettic verification code"
	html := emailclient.EmailVerificationHTML("", otp)
	go func() {
		if err := s.email.SendOTP(email, subject, html); err != nil {
			logger.Warn("Failed to send registration OTP",
				zap.String("email", email),
				zap.Error(err),
			)
		}
	}()
	return nil
}

// VerifyRegistrationOTP verifies the OTP and returns a short-lived registration token
// which is then used to set the password.
func (s *authService) VerifyRegistrationOTP(email, otp string) (string, error) {
	email = utils.NormalizeEmail(email)
	return s.verifyRegistrationOTPAndIssueToken(email, otp)
}

// SetPassword creates the user only after OTP verification.
func (s *authService) SetPassword(registrationToken, password, referralCode string) (*models.User, error) {
	if !utils.ValidatePasswordStrength(password) {
		return nil, utils.NewSafeError("password must be at least 12 characters and include uppercase, lowercase, digit, and a symbol from !@#$%^&*")
	}

	email, err := s.consumeRegistrationToken(registrationToken)
	if err != nil {
		return nil, err
	}

	exists, err := s.userRepo.ExistsByEmail(email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, utils.NewSafeError("user with this email already exists")
	}

	user := &models.User{
		Email:     email,
		Password:  password, // Will be hashed by BeforeCreate hook
		FirstName: "",
		LastName:  "",
		Role:      models.RoleUser,
		IsActive:  true,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	if s.email != nil {
		toEmail := user.Email
		go func() {
			html := emailclient.WelcomeEmailHTML()
			if err := s.email.SendOTP(toEmail, "Welcome to Kynettic!", html); err != nil {
				logger.Warn("Failed to send welcome email", zap.String("email", toEmail), zap.Error(err))
			}
		}()
	}

	// Apply referral code if provided (best-effort; don't fail registration).
	if referralCode != "" && s.referralService != nil {
		if err := s.referralService.ApplyReferralCode(referralCode, user); err != nil {
			logger.Warn("Failed to apply referral code during registration",
				zap.String("user_id", user.ID.String()),
				zap.String("referral_code", referralCode),
				zap.Error(err),
			)
		}
	}

	return user, nil
}

// Login authenticates a user and returns JWT tokens
//
// It also enforces per-email rate limiting using Redis to mitigate credential
// stuffing, as recommended in the security assessment. After a small number of
// consecutive failures, the account is temporarily locked regardless of IP.
func (s *authService) Login(email, password, deviceType, clientIP string) (*LoginResult, error) {
	email = utils.NormalizeEmail(email)

	// If Redis is not enabled, skip rate limiting and fallback to
	// traditional credential validation.
	if cache.Client != nil {
		// Primary: per-email counter. Keyed to email only so IP rotation cannot
		// bypass the lockout — 5 failures lock the account for 15 minutes.
		emailKey := loginAttemptsKey(email)
		if count, err := cache.Client.IncrementBy(emailKey, 0); err == nil && count >= loginMaxFailedAttempts {
			logger.Warn("Login attempt blocked due to lockout",
				zap.String("email", email),
				zap.String("client_ip", clientIP),
				zap.String("reason", "account_temporarily_locked"),
			)
			return nil, utils.NewSafeError(loginLockoutMessage)
		}
		// Secondary: per-IP counter. Higher threshold (20) to block volumetric
		// attacks from a single IP spraying many accounts.
		if clientIP != "" {
			ipKey := loginIPAttemptsKey(clientIP)
			if count, err := cache.Client.IncrementBy(ipKey, 0); err == nil && count >= loginMaxIPFailedAttempts {
				logger.Warn("Login attempt blocked due to IP lockout",
					zap.String("email", email),
					zap.String("client_ip", clientIP),
					zap.String("reason", "ip_temporarily_locked"),
				)
				return nil, utils.NewSafeError(loginLockoutMessage)
			}
		}
	}

	// Find user by email
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			logger.Warn("Login failed: user not found",
				zap.String("email", email),
				zap.String("reason", "user_not_found"),
			)
			_ = s.registerFailedLoginAttempt(email, clientIP)
			return nil, utils.NewSafeError(loginLockoutGenericError)
		}
		return nil, err
	}

	// Check if user is active
	if !user.IsActive {
		logger.Warn("Login failed: account deactivated",
			zap.String("email", email),
			zap.String("user_id", user.ID.String()),
			zap.String("reason", "account_deactivated"),
		)
		return nil, utils.NewSafeError("account is deactivated")
	}

	// Compare password
	if err := utils.ComparePassword(user.Password, password); err != nil {
		logger.Warn("Login failed: invalid password",
			zap.String("email", email),
			zap.String("user_id", user.ID.String()),
			zap.String("reason", "invalid_password"),
		)
		_ = s.registerFailedLoginAttempt(email, clientIP)
		return nil, utils.NewSafeError(loginLockoutGenericError)
	}

	// If 2FA is enabled, issue a short-lived pre_auth token instead of full
	// session tokens. The client must exchange this via VerifyTwoFA.
	if has2FA, _ := s.userHas2FAEnabled(user.ID); has2FA {
		jti := uuid.New().String()
		preAuthToken, err := utils.GenerateToken(
			user.ID,
			user.Email,
			string(user.Role),
			s.config.JWT.Secret,
			preAuthTokenTTL,
			utils.WithTokenType("pre_auth"),
			utils.WithDeviceType(deviceType),
			utils.WithJTI(jti),
		)
		if err != nil {
			return nil, err
		}
		logger.Info("Login step 1 complete — pre_auth token issued",
			zap.String("email", email),
			zap.String("user_id", user.ID.String()),
		)
		return &LoginResult{PreAuthToken: preAuthToken}, nil
	}

	// Successful login: clear the per-email failure counter. The per-IP counter
	// is intentionally NOT cleared — it must keep accumulating so that rotating
	// to a valid account cannot reset the IP's volumetric guard.
	if cache.Client != nil {
		_ = cache.Client.Delete(loginAttemptsKey(email))
	}

	accessToken, refreshToken, err := s.generateTokensWithSession(user, deviceType)
	if err != nil {
		return nil, err
	}

	logger.Info("Login successful",
		zap.String("email", email),
		zap.String("user_id", user.ID.String()),
		zap.String("role", string(user.Role)),
		zap.String("device_type", deviceType),
	)

	return &LoginResult{AccessToken: accessToken, RefreshToken: refreshToken, User: user}, nil
}

// VerifyTwoFA exchanges a pre_auth token and a TOTP code for full session tokens.
func (s *authService) VerifyTwoFA(preAuthToken, totpCode string) (string, string, *models.User, error) {
	claims, err := utils.ValidateToken(preAuthToken, s.config.JWT.Secret)
	if err != nil {
		return "", "", nil, utils.NewSafeError("invalid or expired pre-auth token")
	}
	if claims.TokenType != "pre_auth" {
		return "", "", nil, utils.NewSafeError("invalid token type")
	}

	// Enforce single-use: reject if this JTI has already been consumed.
	if cache.Client != nil && claims.ID != "" {
		usedKey := preAuthTokenUsedKey(claims.ID)
		if _, err := cache.Client.Get(usedKey); err == nil {
			return "", "", nil, utils.NewSafeError("pre-auth token has already been used")
		}
	}

	user, err := s.userRepo.FindByID(claims.UserID)
	if err != nil {
		return "", "", nil, utils.NewSafeError("user not found")
	}
	if !user.IsActive {
		return "", "", nil, utils.NewSafeError("account is deactivated")
	}

	// Enforce lockout before attempting TOTP validation. Without this check the
	// counter is incremented on each failure but the gate is never evaluated,
	// allowing unlimited brute-force attempts within the pre_auth token window.
	// The pre_auth token is only issued after correct password auth, so there is
	// no meaningful DoS risk here — we use a fixed IP sentinel so the key still
	// matches what Login() set when the pre_auth token was issued.
	if cache.Client != nil {
		key := loginAttemptsKey(user.Email)
		if count, err := cache.Client.IncrementBy(key, 0); err == nil && count >= loginMaxFailedAttempts {
			logger.Warn("VerifyTwoFA blocked: too many failed attempts",
				zap.String("user_id", user.ID.String()),
				zap.String("reason", "account_temporarily_locked"),
			)
			return "", "", nil, utils.NewSafeError(loginLockoutMessage)
		}
	}

	db := database.GetDB()
	var sec models.UserSecurity
	if err := db.Where("user_id = ?", user.ID).First(&sec).Error; err != nil {
		return "", "", nil, utils.NewSafeError("2FA not configured for this account")
	}
	if !sec.TwoFAEnabled || strings.TrimSpace(sec.TwoFASecret) == "" {
		return "", "", nil, utils.NewSafeError("2FA not enabled for this account")
	}

	if !utils.ValidateTOTPCode(sec.TwoFASecret, totpCode) {
		logger.Warn("VerifyTwoFA failed: invalid TOTP code",
			zap.String("user_id", user.ID.String()),
		)
		_ = s.registerFailedLoginAttempt(user.Email, "")
		return "", "", nil, utils.NewSafeError("invalid authenticator code")
	}

	if err := ConsumeTOTPCode(user.ID, totpCode); err != nil {
		return "", "", nil, err
	}

	// Mark this pre_auth token's JTI as consumed so it cannot be replayed.
	if cache.Client != nil && claims.ID != "" {
		remaining := time.Until(claims.ExpiresAt.Time)
		if remaining > 0 {
			_ = cache.Client.Set(preAuthTokenUsedKey(claims.ID), "1", remaining)
		}
	}

	// Clear any failed login attempts on success.
	if cache.Client != nil {
		_ = cache.Client.Delete(loginAttemptsKey(user.Email))
	}

	deviceType := claims.DeviceType
	accessToken, refreshToken, err := s.generateTokensWithSession(user, deviceType)
	if err != nil {
		return "", "", nil, err
	}

	logger.Info("2FA verification successful — session issued",
		zap.String("user_id", user.ID.String()),
		zap.String("device_type", deviceType),
	)

	return accessToken, refreshToken, user, nil
}

// userHas2FAEnabled checks if user has 2FA enabled in their security settings.
func (s *authService) userHas2FAEnabled(userID uuid.UUID) (bool, error) {
	db := database.GetDB()
	var sec models.UserSecurity
	if err := db.Where("user_id = ?", userID).First(&sec).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	return sec.TwoFAEnabled && strings.TrimSpace(sec.TwoFASecret) != "", nil
}

// LoginWith2FA authenticates a user with email, password, and TOTP code.
func (s *authService) LoginWith2FA(email, password, totpCode, deviceType, clientIP string) (string, string, *models.User, error) {
	email = utils.NormalizeEmail(email)

	// Rate limiting check: same two-tier check as Login().
	if cache.Client != nil {
		emailKey := loginAttemptsKey(email)
		if count, err := cache.Client.IncrementBy(emailKey, 0); err == nil && count >= loginMaxFailedAttempts {
			logger.Warn("2FA login attempt blocked due to lockout",
				zap.String("email", email),
				zap.String("client_ip", clientIP),
				zap.String("reason", "account_temporarily_locked"),
			)
			return "", "", nil, utils.NewSafeError(loginLockoutMessage)
		}
		if clientIP != "" {
			ipKey := loginIPAttemptsKey(clientIP)
			if count, err := cache.Client.IncrementBy(ipKey, 0); err == nil && count >= loginMaxIPFailedAttempts {
				logger.Warn("2FA login attempt blocked due to IP lockout",
					zap.String("email", email),
					zap.String("client_ip", clientIP),
					zap.String("reason", "ip_temporarily_locked"),
				)
				return "", "", nil, utils.NewSafeError(loginLockoutMessage)
			}
		}
	}

	// Find user by email
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			logger.Warn("2FA login failed: user not found",
				zap.String("email", email),
				zap.String("reason", "user_not_found"),
			)
			_ = s.registerFailedLoginAttempt(email, clientIP)
			return "", "", nil, utils.NewSafeError(loginLockoutGenericError)
		}
		return "", "", nil, err
	}

	// Check if user is active
	if !user.IsActive {
		logger.Warn("2FA login failed: account deactivated",
			zap.String("email", email),
			zap.String("user_id", user.ID.String()),
			zap.String("reason", "account_deactivated"),
		)
		return "", "", nil, utils.NewSafeError("account is deactivated")
	}

	// Compare password
	if err := utils.ComparePassword(user.Password, password); err != nil {
		logger.Warn("2FA login failed: invalid password",
			zap.String("email", email),
			zap.String("user_id", user.ID.String()),
			zap.String("reason", "invalid_password"),
		)
		_ = s.registerFailedLoginAttempt(email, clientIP)
		return "", "", nil, utils.NewSafeError(loginLockoutGenericError)
	}

	// Verify TOTP code
	db := database.GetDB()
	var sec models.UserSecurity
	if err := db.Where("user_id = ?", user.ID).First(&sec).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			logger.Warn("2FA login failed: 2FA not configured",
				zap.String("email", email),
				zap.String("user_id", user.ID.String()),
			)
			return "", "", nil, utils.NewSafeError("2FA not configured for this account")
		}
		return "", "", nil, err
	}

	if !sec.TwoFAEnabled || strings.TrimSpace(sec.TwoFASecret) == "" {
		logger.Warn("2FA login failed: 2FA not enabled",
			zap.String("email", email),
			zap.String("user_id", user.ID.String()),
		)
		return "", "", nil, utils.NewSafeError("2FA not enabled for this account")
	}

	if !utils.ValidateTOTPCode(sec.TwoFASecret, totpCode) {
		logger.Warn("2FA login failed: invalid TOTP code",
			zap.String("email", email),
			zap.String("user_id", user.ID.String()),
			zap.String("reason", "invalid_totp"),
		)
		_ = s.registerFailedLoginAttempt(email, clientIP)
		return "", "", nil, utils.NewSafeError("invalid authenticator code")
	}

	if err := ConsumeTOTPCode(user.ID, totpCode); err != nil {
		return "", "", nil, err
	}

	// Successful login: clear the per-email failure counter. Per-IP counter is
	// intentionally NOT cleared (see Login()).
	if cache.Client != nil {
		_ = cache.Client.Delete(loginAttemptsKey(email))
	}

	accessToken, refreshToken, err := s.generateTokensWithSession(user, deviceType)
	if err != nil {
		return "", "", nil, err
	}

	logger.Info("2FA login successful",
		zap.String("email", email),
		zap.String("user_id", user.ID.String()),
		zap.String("role", string(user.Role)),
		zap.String("device_type", deviceType),
	)

	return accessToken, refreshToken, user, nil
}

// registerFailedLoginAttempt increments two independent counters in Redis:
//   - Per-email counter (primary): locks the account after loginMaxFailedAttempts
//     regardless of the caller's IP, so IP rotation cannot bypass it.
//   - Per-IP counter (secondary): locks the IP after loginMaxIPFailedAttempts to
//     block volumetric credential stuffing from a single source. Skipped when
//     clientIP is empty (e.g. VerifyTwoFA, which has no useful IP context).
func (s *authService) registerFailedLoginAttempt(email, clientIP string) error {
	if cache.Client == nil {
		return nil
	}

	// --- Primary: per-email counter ---
	emailKey := loginAttemptsKey(email)
	emailCount, err := cache.Client.Increment(emailKey)
	if err != nil {
		return err
	}
	if emailCount == 1 {
		if err := cache.Client.Expire(emailKey, loginFailedAttemptsTTL); err != nil {
			return err
		}
	}
	if emailCount >= loginMaxFailedAttempts {
		logger.Warn("Account temporarily locked due to failed login attempts",
			zap.String("email", email),
			zap.Int64("failed_attempts", emailCount),
			zap.Duration("lockout_ttl", loginFailedAttemptsTTL),
		)
	}

	// --- Secondary: per-IP counter ---
	if clientIP == "" {
		return nil
	}
	ipKey := loginIPAttemptsKey(clientIP)
	ipCount, err := cache.Client.Increment(ipKey)
	if err != nil {
		return err
	}
	if ipCount == 1 {
		if err := cache.Client.Expire(ipKey, loginFailedAttemptsTTL); err != nil {
			return err
		}
	}
	if ipCount >= loginMaxIPFailedAttempts {
		logger.Warn("IP temporarily locked out due to failed login attempts",
			zap.String("client_ip", clientIP),
			zap.Int64("failed_attempts", ipCount),
			zap.Duration("lockout_ttl", loginFailedAttemptsTTL),
		)
	}

	return nil
}

// generateTokensForUser issues access and refresh tokens for the given user.
func (s *authService) generateTokensForUser(user *models.User) (string, string, error) {
	// Generate access token
	accessToken, err := utils.GenerateToken(
		user.ID,
		user.Email,
		string(user.Role),
		s.config.JWT.Secret,
		s.config.JWT.Expiration,
		utils.WithTokenType("access"),
	)
	if err != nil {
		return "", "", err
	}

	// Generate refresh token
	refreshToken, err := utils.GenerateToken(
		user.ID,
		user.Email,
		string(user.Role),
		s.config.JWT.RefreshSecret,
		s.config.JWT.RefreshExpiration,
		utils.WithTokenType("refresh"),
	)
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

// generateTokensWithSession creates a new session and issues tokens bound to it.
// The previous session for the same device type is automatically replaced.
func (s *authService) generateTokensWithSession(user *models.User, deviceType string) (string, string, error) {
	sessionID, err := utils.GenerateSessionID()
	if err != nil {
		return "", "", err
	}

	// Store active session in Redis (keyed by user + device type).
	// TTL is set to the inactivity timeout; each authenticated request refreshes it.
	if cache.Client != nil {
		key := sessionKey(user.ID, deviceType)
		if err := cache.Client.Set(key, sessionID, s.config.Session.InactivityTimeout); err != nil {
		logger.Warn("Failed to store session in Redis; proceeding without session enforcement",
				zap.String("user_id", user.ID.String()),
				zap.String("device_type", deviceType),
				zap.Error(err),
			)
		}
	}

	opt := utils.WithSession(sessionID, deviceType)

	accessToken, err := utils.GenerateToken(
		user.ID,
		user.Email,
		string(user.Role),
		s.config.JWT.Secret,
		s.config.JWT.Expiration,
		opt,
		utils.WithTokenType("access"),
	)
	if err != nil {
		return "", "", err
	}

	refreshToken, err := utils.GenerateToken(
		user.ID,
		user.Email,
		string(user.Role),
		s.config.JWT.RefreshSecret,
		s.config.JWT.RefreshExpiration,
		opt,
		utils.WithTokenType("refresh"),
	)
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

// Logout invalidates the active session for the given user and device type.
func (s *authService) Logout(userID uuid.UUID, deviceType string) error {
	if cache.Client == nil {
		return nil
	}
	return cache.Client.Delete(sessionKey(userID, deviceType))
}

// RefreshToken generates a new access token using a refresh token.
// It also validates that the session is still active in Redis.
func (s *authService) RefreshToken(refreshToken string) (string, error) {
	// Parse the refresh token to check session validity before issuing a new access token.
	claims, err := utils.ValidateToken(refreshToken, s.config.JWT.RefreshSecret)
	if err != nil {
		return "", err
	}

	// Reject any token that is not explicitly typed as a refresh token.
	if claims.TokenType != "refresh" {
		return "", utils.NewSafeError("invalid token type: refresh token required")
	}

	// If the token carries a session ID, verify it is still the active session.
	if claims.SessionID != "" && cache.Client != nil {
		key := sessionKey(claims.UserID, claims.DeviceType)
		active, err := cache.Client.Get(key)
		if err != nil {
			// Key not found means the session was invalidated (logged out or replaced).
			return "", utils.NewSafeError("session expired, please log in again")
		}
		if active != claims.SessionID {
			return "", utils.NewSafeError("session expired, please log in again")
		}
		// Refresh the inactivity TTL since this counts as activity.
		_ = cache.Client.Expire(key, s.config.Session.InactivityTimeout)
	}

	// Re-fetch the user to pick up any role/email/status changes made since the
	// refresh token was issued. This prevents stale admin privileges from persisting
	// after a role downgrade.
	user, err := s.userRepo.FindByID(claims.UserID)
	if err != nil {
		return "", utils.NewSafeError("session expired, please log in again")
	}
	if !user.IsActive {
		return "", utils.NewSafeError("account is deactivated")
	}

	// Session is valid; issue a new access token with fresh claims.
	var opts []utils.TokenOption
	if claims.SessionID != "" {
		opts = append(opts, utils.WithSession(claims.SessionID, claims.DeviceType))
	}
	opts = append(opts, utils.WithTokenType("access"))

	return utils.GenerateToken(user.ID, user.Email, string(user.Role), s.config.JWT.Secret, s.config.JWT.Expiration, opts...)
}

// LoginWithGoogle authenticates or auto-creates a user using a Google ID token.
func (s *authService) LoginWithGoogle(ctx context.Context, idToken, nonce, deviceType, referralCode string) (string, string, *models.User, error) {
	payload, err := oauth.VerifyGoogleIDToken(ctx, &s.config.GoogleAuth, idToken, nonce)
	if err != nil {
		return "", "", nil, err
	}

	email := utils.NormalizeEmail(payload.Email)

	var isNewUser bool
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return "", "", nil, err
		}
		// Auto-create user if not found.
		password, err := utils.GenerateStrongPassword(utils.MinPasswordLength)
		if err != nil {
			return "", "", nil, err
		}

		user = &models.User{
			Email:     email,
			Password:  password,
			FirstName: "",
			LastName:  "",
			Role:      models.RoleUser,
			IsActive:  true,
		}

		if err := s.userRepo.Create(user); err != nil {
			return "", "", nil, err
		}
		isNewUser = true
	}

	if !user.IsActive {
		logger.Warn("Google login failed: account deactivated",
			zap.String("email", email),
			zap.String("user_id", user.ID.String()),
			zap.String("reason", "account_deactivated"),
		)
		return "", "", nil, utils.NewSafeError("account is deactivated")
	}

	// Apply referral code only for new users (best-effort).
	if isNewUser && referralCode != "" && s.referralService != nil {
		if err := s.referralService.ApplyReferralCode(referralCode, user); err != nil {
			logger.Warn("Failed to apply referral code during Google registration",
				zap.String("user_id", user.ID.String()),
				zap.String("referral_code", referralCode),
				zap.Error(err),
			)
		}
	}

	if isNewUser && s.email != nil {
		toEmail := user.Email
		go func() {
			html := emailclient.WelcomeEmailHTML()
			if err := s.email.SendOTP(toEmail, "Welcome to Kynettic!", html); err != nil {
				logger.Warn("Failed to send welcome email", zap.String("email", toEmail), zap.Error(err))
			}
		}()
	}

	accessToken, refreshToken, err := s.generateTokensWithSession(user, deviceType)
	if err != nil {
		return "", "", nil, err
	}

	logger.Info("Google login successful",
		zap.String("email", email),
		zap.String("user_id", user.ID.String()),
		zap.String("role", string(user.Role)),
		zap.String("device_type", deviceType),
	)

	return accessToken, refreshToken, user, nil
}

// LoginWithApple authenticates or auto-creates a user using an Apple ID token.
func (s *authService) LoginWithApple(ctx context.Context, idToken, nonce, deviceType, referralCode string) (string, string, *models.User, error) {
	claims, err := oauth.VerifyAppleIDToken(ctx, &s.config.AppleAuth, idToken, nonce)
	if err != nil {
		return "", "", nil, err
	}

	email := utils.NormalizeEmail(claims.Email)

	var isNewUser bool
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return "", "", nil, err
		}
		// Auto-create user if not found.
		password, err := utils.GenerateStrongPassword(utils.MinPasswordLength)
		if err != nil {
			return "", "", nil, err
		}

		user = &models.User{
			Email:     email,
			Password:  password,
			FirstName: "",
			LastName:  "",
			Role:      models.RoleUser,
			IsActive:  true,
		}

		if err := s.userRepo.Create(user); err != nil {
			return "", "", nil, err
		}
		isNewUser = true
	}

	if !user.IsActive {
		logger.Warn("Apple login failed: account deactivated",
			zap.String("email", email),
			zap.String("user_id", user.ID.String()),
			zap.String("reason", "account_deactivated"),
		)
		return "", "", nil, utils.NewSafeError("account is deactivated")
	}

	// Apply referral code only for new users (best-effort).
	if isNewUser && referralCode != "" && s.referralService != nil {
		if err := s.referralService.ApplyReferralCode(referralCode, user); err != nil {
			logger.Warn("Failed to apply referral code during Apple registration",
				zap.String("user_id", user.ID.String()),
				zap.String("referral_code", referralCode),
				zap.Error(err),
			)
		}
	}

	if isNewUser && s.email != nil {
		toEmail := user.Email
		go func() {
			html := emailclient.WelcomeEmailHTML()
			if err := s.email.SendOTP(toEmail, "Welcome to Kynettic!", html); err != nil {
				logger.Warn("Failed to send welcome email", zap.String("email", toEmail), zap.Error(err))
			}
		}()
	}

	accessToken, refreshToken, err := s.generateTokensWithSession(user, deviceType)
	if err != nil {
		return "", "", nil, err
	}

	logger.Info("Apple login successful",
		zap.String("email", email),
		zap.String("user_id", user.ID.String()),
		zap.String("role", string(user.Role)),
		zap.String("device_type", deviceType),
	)

	return accessToken, refreshToken, user, nil
}
