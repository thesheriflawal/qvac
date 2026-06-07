package service

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	emailclient "github.com/Kynettic-org/kynettic-backend/internal/clients/email"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"go.uber.org/zap"
)

const (
	passwordResetOTPTTL            = 10 * time.Minute
	passwordResetOTPMinResend      = 60 * time.Second
	passwordResetOTPMaxSendsPerTTL = 3
	passwordResetOTPMaxVerifyTries = 5
	passwordResetTokenTTL          = 10 * time.Minute
	passwordResetTokenBytes        = 32
)

type passwordResetOTPState struct {
	OTPHash    string    `json:"otp_hash"`
	ExpiresAt  time.Time `json:"expires_at"`
	SentCount  int       `json:"sent_count"`
	LastSentAt time.Time `json:"last_sent_at"`
}

func passwordResetOTPKey(email string) string {
	return "auth:pwreset:otp:" + email
}

func passwordResetTokenKey(token string) string {
	return "auth:pwreset:token:" + token
}

func passwordResetAttemptsKey(email string) string {
	return "auth:pwreset:attempts:" + email
}

func (s *authService) RequestPasswordResetOTP(email string) error {
	email = utils.NormalizeEmail(email)

	if err := s.requireRedis(); err != nil {
		return err
	}

	// Look up the user but don't reveal to the caller whether the email is
	// registered or what the account status is — both would allow enumeration.
	// Log internally and return nil so the response is identical to a
	// successful OTP send.
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		logger.Info("Password reset OTP requested for unregistered email",
			zap.String("email", email),
		)
		return nil
	}
	if !user.IsActive {
		logger.Info("Password reset OTP requested for deactivated account",
			zap.String("email", email),
		)
		return nil
	}

	now := time.Now().UTC()
	key := passwordResetOTPKey(email)

	// Load existing state (for resend rate limiting).
	var existing passwordResetOTPState
	err = cache.Client.GetJSON(key, &existing)
	if err != nil && !isKeyNotFoundErr(err) {
		return err
	}
	if err == nil {
		if now.After(existing.ExpiresAt) {
			_ = cache.Client.Delete(key)
		} else {
			if now.Sub(existing.LastSentAt) < passwordResetOTPMinResend {
				return utils.NewSafeError("otp recently sent; please wait before requesting a new one")
			}
			if existing.SentCount >= passwordResetOTPMaxSendsPerTTL {
				return utils.NewSafeError("too many otp requests; please try again later")
			}
		}
	}

	sentCount := 1
	if err == nil && now.Before(existing.ExpiresAt) {
		sentCount = existing.SentCount + 1
	}

	otp, err := utils.Generate6DigitOTP()
	if err != nil {
		return err
	}

	state := passwordResetOTPState{
		OTPHash:    utils.HashOTP(email, otp, s.config.JWT.Secret),
		ExpiresAt:  now.Add(passwordResetOTPTTL),
		SentCount:  sentCount,
		LastSentAt: now,
	}

	if err := cache.Client.SetJSON(key, state, passwordResetOTPTTL); err != nil {
		return err
	}

	// Reset the attempt counter so a freshly issued OTP always starts at zero.
	_ = cache.Client.Delete(passwordResetAttemptsKey(email))

	if s.email == nil {
		return utils.NewSafeError("email sender not configured")
	}

	subject := "Your Kynettic password reset code"
	html := emailclient.PasswordResetEmailHTML(user.FirstName, otp)
	go func() {
		if err := s.email.SendOTP(email, subject, html); err != nil {
			logger.Warn("Failed to send password reset OTP",
				zap.String("email", email),
				zap.Error(err),
			)
		}
	}()
	return nil
}

func (s *authService) VerifyPasswordResetOTP(email, otp string) (string, error) {
	email = utils.NormalizeEmail(email)

	if err := s.requireRedis(); err != nil {
		return "", err
	}

	now := time.Now().UTC()
	key := passwordResetOTPKey(email)

	var state passwordResetOTPState
	if err := cache.Client.GetJSON(key, &state); err != nil {
		if isKeyNotFoundErr(err) {
			return "", utils.NewSafeError("otp not found or expired")
		}
		return "", err
	}

	if now.After(state.ExpiresAt) {
		_ = cache.Client.Delete(key)
		logger.Warn("Password reset OTP verification failed: OTP expired",
			zap.String("email", email),
			zap.String("reason", "otp_expired"),
		)
		return "", utils.NewSafeError("otp not found or expired")
	}

	// Atomically increment the attempt counter. INCR is a single Redis
	// command, so concurrent requests each receive a distinct value and
	// cannot observe the same counter state simultaneously.
	attemptsKey := passwordResetAttemptsKey(email)
	attempts, err := cache.Client.Increment(attemptsKey)
	if err != nil {
		return "", err
	}
	// Tie the counter's lifetime to the OTP window on first use.
	if attempts == 1 {
		_ = cache.Client.Expire(attemptsKey, passwordResetOTPTTL)
	}
	if attempts > passwordResetOTPMaxVerifyTries {
		logger.Warn("Password reset OTP verification failed: max attempts reached",
			zap.String("email", email),
			zap.Int64("attempts", attempts),
			zap.String("reason", "max_attempts_reached"),
		)
		return "", ErrOTPRateLimited
	}

	expected := state.OTPHash
	actual := utils.HashOTP(email, otp, s.config.JWT.Secret)
	if subtle.ConstantTimeCompare([]byte(expected), []byte(actual)) != 1 {
		logger.Warn("Password reset OTP verification failed: invalid OTP",
			zap.String("email", email),
			zap.Int64("attempts", attempts),
			zap.String("reason", "invalid_otp"),
		)
		return "", utils.NewSafeError("invalid otp")
	}

	_ = cache.Client.Delete(key, attemptsKey)

	logger.Info("Password reset OTP verified successfully",
		zap.String("email", email),
	)

	b := make([]byte, passwordResetTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(b)

	if err := cache.Client.Set(passwordResetTokenKey(token), email, passwordResetTokenTTL); err != nil {
		return "", err
	}

	return token, nil
}

func (s *authService) ResetPassword(resetToken, newPassword string) error {
	if err := s.requireRedis(); err != nil {
		return err
	}
	if strings.TrimSpace(resetToken) == "" {
		return utils.NewSafeError("reset token is required")
	}

	if !utils.ValidatePasswordStrength(newPassword) {
		return utils.NewSafeError("password must be at least 12 characters and include uppercase, lowercase, digit, and a symbol from !@#$%^&*")
	}

	email, err := cache.Client.Get(passwordResetTokenKey(resetToken))
	if err != nil {
		if isKeyNotFoundErr(err) {
			return utils.NewSafeError("invalid or expired reset token")
		}
		return err
	}
	_ = cache.Client.Delete(passwordResetTokenKey(resetToken))

	user, err := s.userRepo.FindByEmail(utils.NormalizeEmail(email))
	if err != nil {
		return utils.NewSafeError("user not found")
	}
	if !user.IsActive {
		return utils.NewSafeError("account is deactivated")
	}

	// Assign plaintext; the BeforeUpdate hook always hashes it.
	user.Password = newPassword

	if err := s.userRepo.Update(user); err != nil {
		return err
	}

	// Invalidate all active sessions so any stolen tokens are revoked.
	if cache.Client != nil {
		for _, dt := range []string{"web", "mobile"} {
			_ = cache.Client.Delete(fmt.Sprintf("session:%s:%s", user.ID.String(), dt))
		}
	}

	logger.Info("Password reset completed successfully",
		zap.String("email", email),
		zap.String("user_id", user.ID.String()),
	)

	return nil
}
