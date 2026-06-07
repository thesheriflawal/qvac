package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	pinMaxFailedAttempts = 5
	pinLockoutTTL        = 15 * time.Minute
	pinLockoutMessage    = "too many failed attempts; financial operations are temporarily locked for this account"
)

// ErrTwoFACodeRequired is returned when an operation requires a TOTP code but
// the user has 2FA enabled and no (or empty) code was provided. Handlers map
// this to HTTP 403 with { "requires_2fa": true } so the client can advance to
// the TOTP step automatically.
var ErrTwoFACodeRequired = errors.New("2FA code required")

// ErrPINRateLimited is returned by checkPINLockout when the user has exceeded
// the maximum number of failed PIN/TOTP attempts. Handlers must translate this
// to HTTP 429 with a Retry-After header set to RetryAfter.Seconds().
type ErrPINRateLimited struct {
	RetryAfter time.Duration
}

func (e *ErrPINRateLimited) Error() string { return pinLockoutMessage }

// ErrOTPRateLimited is returned by OTP verification functions when the caller
// has exceeded the maximum number of verification attempts. Handlers must
// translate this to HTTP 429.
var ErrOTPRateLimited = errors.New("too many invalid otp attempts")

func pinAttemptsKey(userID uuid.UUID) string {
	return fmt.Sprintf("security:pin:attempts:%s", userID.String())
}

// registerFailedPINAttempt atomically increments the per-user failure counter
// and sets the lockout TTL on the first failure. Using IncrementWithExpiry
// (a Lua script) ensures INCR and EXPIRE are a single atomic operation so a
// crash between the two cannot leave the key without a TTL and cause a
// permanent lockout.
func registerFailedPINAttempt(userID uuid.UUID) {
	if cache.Client == nil {
		return
	}
	count, err := cache.Client.IncrementWithExpiry(pinAttemptsKey(userID), pinLockoutTTL)
	if err != nil {
		return
	}
	if count >= pinMaxFailedAttempts {
		logger.Warn("PIN/TOTP lockout triggered for financial operations",
			zap.String("user_id", userID.String()),
			zap.Int64("attempts", count),
		)
	}
}

// clearPINAttempts resets the failure counter after a successful verification.
func clearPINAttempts(userID uuid.UUID) {
	if cache.Client == nil {
		return
	}
	_ = cache.Client.Delete(pinAttemptsKey(userID))
}

// checkPINLockout returns ErrPINRateLimited (with the remaining TTL) if the
// user has exceeded the PIN failure threshold, nil otherwise. Callers must
// use errors.As to extract the RetryAfter duration for the Retry-After header.
func checkPINLockout(userID uuid.UUID) error {
	if cache.Client == nil {
		return nil
	}
	key := pinAttemptsKey(userID)
	ttl, err := cache.Client.TTL(key)
	if err != nil || ttl <= 0 {
		return nil
	}
	count, err := cache.Client.IncrementBy(key, 0)
	if err != nil {
		return nil
	}
	if count >= pinMaxFailedAttempts {
		logger.Warn("PIN/TOTP lockout enforced",
			zap.String("user_id", userID.String()),
			zap.Int64("attempts", count),
			zap.Duration("retry_after", ttl),
		)
		return &ErrPINRateLimited{RetryAfter: ttl}
	}
	return nil
}

// verifyUserPin ensures that a 6-digit transaction PIN is valid for the given
// user. It requires that the user has a PIN configured but does not check 2FA.
func verifyUserPin(userID uuid.UUID, pin string) error {
	pin = strings.TrimSpace(pin)

	if userID == uuid.Nil {
		return utils.NewSafeError("invalid user")
	}

	if err := checkPINLockout(userID); err != nil {
		return err
	}

	var sec models.UserSecurity
	if err := database.GetDB().Where("user_id = ?", userID).First(&sec).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.NewSafeError("security settings not configured")
		}
		return err
	}

	if !sec.PinEnabled || strings.TrimSpace(sec.PinHash) == "" {
		return utils.NewSafeError("PIN not configured")
	}

	if pin == "" {
		return utils.NewSafeError("pin is required")
	}

	if err := utils.VerifyPIN(sec.PinHash, pin); err != nil {
		logger.Warn("Invalid PIN attempt", zap.String("user_id", userID.String()))
		registerFailedPINAttempt(userID)
		return utils.NewSafeError("invalid PIN")
	}

	// Silently upgrade legacy plain-bcrypt hashes to the peppered format on
	// the next successful verification so users are never locked out.
	if !utils.IsPepperedPINHash(sec.PinHash) {
		if newHash, hashErr := utils.HashPIN(pin); hashErr == nil {
			_ = database.GetDB().Model(&sec).Update("pin_hash", newHash).Error
		}
	}

	clearPINAttempts(userID)
	return nil
}

// verifyUserPinAndAuthenticator ensures that both a 6-digit transaction PIN and a
// 6-digit Google Authenticator (TOTP) code are valid for the given user. It
// requires that the user has both PIN and 2FA configured.
func verifyUserPinAndAuthenticator(userID uuid.UUID, pin, authCode string) error {
	pin = strings.TrimSpace(pin)
	authCode = strings.TrimSpace(authCode)

	if userID == uuid.Nil {
		return utils.NewSafeError("invalid user")
	}

	// Check lockout before doing any work. A single counter covers both PIN and
	// TOTP failures so an attacker cannot cycle through PINs freely after finding
	// the correct one.
	if err := checkPINLockout(userID); err != nil {
		return err
	}

	var sec models.UserSecurity
	if err := database.GetDB().Where("user_id = ?", userID).First(&sec).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return utils.NewSafeError("security settings not configured")
		}
		return err
	}

	if !sec.PinEnabled || strings.TrimSpace(sec.PinHash) == "" {
		return utils.NewSafeError("PIN not configured")
	}

	if pin == "" {
		return utils.NewSafeError("pin is required")
	}

	if err := utils.VerifyPIN(sec.PinHash, pin); err != nil {
		logger.Warn("Invalid PIN attempt", zap.String("user_id", userID.String()))
		registerFailedPINAttempt(userID)
		return utils.NewSafeError("invalid PIN")
	}

	if !utils.IsPepperedPINHash(sec.PinHash) {
		if newHash, hashErr := utils.HashPIN(pin); hashErr == nil {
			_ = database.GetDB().Model(&sec).Update("pin_hash", newHash).Error
		}
	}

	// Only enforce TOTP when the user has 2FA configured. If 2FA is enabled
	// and auth_code is missing, return ErrTwoFACodeRequired so the handler
	// can respond with 403 + { "requires_2fa": true }.
	if sec.TwoFAEnabled && strings.TrimSpace(sec.TwoFASecret) != "" {
		if strings.TrimSpace(authCode) == "" {
			return ErrTwoFACodeRequired
		}
		if !utils.ValidateTOTPCode(sec.TwoFASecret, authCode) {
			logger.Warn("Invalid authenticator code attempt", zap.String("user_id", userID.String()))
			registerFailedPINAttempt(userID)
			return utils.NewSafeError("invalid authenticator code")
		}
		if err := ConsumeTOTPCode(userID, authCode); err != nil {
			registerFailedPINAttempt(userID)
			return err
		}
	}

	// PIN (and TOTP if enabled) verified — clear failure counter.
	clearPINAttempts(userID)
	return nil
}
