package service

import (
	"crypto/subtle"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

const (
	emailChangeOTPTTL            = 10 * time.Minute
	emailChangeOTPMinResend      = 60 * time.Second
	emailChangeOTPMaxSendsPerTTL = 3
	emailChangeOTPMaxVerifyTries = 5
)

type emailChangeOTPState struct {
	OTPHash    string    `json:"otp_hash"`
	NewEmail   string    `json:"new_email"`
	ExpiresAt  time.Time `json:"expires_at"`
	SentCount  int       `json:"sent_count"`
	LastSentAt time.Time `json:"last_sent_at"`
}

func emailChangeOTPKey(userID uuid.UUID) string {
	return "user:emailchange:" + userID.String()
}

func emailChangeOTPAttemptsKey(userID uuid.UUID) string {
	return "user:emailchange:attempts:" + userID.String()
}

func (s *userService) requireRedis() error {
	if cache.Client == nil || cache.GetClient() == nil {
		return utils.NewSafeError("redis is required for OTP verification")
	}
	return nil
}

func (s *userService) storeEmailChangeOTP(userID uuid.UUID, newEmail, otp string) error {
	if err := s.requireRedis(); err != nil {
		return err
	}

	now := time.Now().UTC()
	key := emailChangeOTPKey(userID)

	var existing emailChangeOTPState
	err := cache.Client.GetJSON(key, &existing)
	if err != nil && !isKeyNotFoundErr(err) {
		return err
	}

	if err == nil {
		if now.After(existing.ExpiresAt) {
			_ = cache.Client.Delete(key)
		} else {
			if now.Sub(existing.LastSentAt) < emailChangeOTPMinResend {
				return utils.NewSafeError("otp recently sent; please wait before requesting a new one")
			}
			if existing.SentCount >= emailChangeOTPMaxSendsPerTTL {
				return utils.NewSafeError("too many otp requests; please try again later")
			}
		}
	}

	sentCount := 1
	if err == nil && now.Before(existing.ExpiresAt) {
		sentCount = existing.SentCount + 1
	}

	state := emailChangeOTPState{
		OTPHash:    utils.HashOTP(newEmail, otp, s.config.JWT.Secret),
		NewEmail:   newEmail,
		ExpiresAt:  now.Add(emailChangeOTPTTL),
		SentCount:  sentCount,
		LastSentAt: now,
	}

	if err := cache.Client.SetJSON(key, state, emailChangeOTPTTL); err != nil {
		return err
	}

	// Reset the attempt counter so a freshly issued OTP always starts at zero.
	_ = cache.Client.Delete(emailChangeOTPAttemptsKey(userID))
	return nil
}

func (s *userService) verifyEmailChangeOTP(userID uuid.UUID, otp string) (string, error) {
	if err := s.requireRedis(); err != nil {
		return "", err
	}

	now := time.Now().UTC()
	key := emailChangeOTPKey(userID)

	var state emailChangeOTPState
	if err := cache.Client.GetJSON(key, &state); err != nil {
		if isKeyNotFoundErr(err) {
			return "", utils.NewSafeError("otp not found or expired")
		}
		return "", err
	}

	if now.After(state.ExpiresAt) {
		_ = cache.Client.Delete(key)
		logger.Warn("Email change OTP expired", zap.String("user_id", userID.String()))
		return "", utils.NewSafeError("otp not found or expired")
	}

	// Atomically increment the attempt counter. INCR is a single Redis
	// command, so concurrent requests each receive a distinct value and
	// cannot observe the same counter state simultaneously (no TOCTOU).
	attemptsKey := emailChangeOTPAttemptsKey(userID)
	attempts, err := cache.Client.Increment(attemptsKey)
	if err != nil {
		return "", err
	}
	// Tie the counter's lifetime to the OTP window on first use.
	if attempts == 1 {
		_ = cache.Client.Expire(attemptsKey, emailChangeOTPTTL)
	}
	if attempts > emailChangeOTPMaxVerifyTries {
		logger.Warn("Email change OTP max attempts reached",
			zap.String("user_id", userID.String()),
			zap.Int64("attempts", attempts),
		)
		return "", ErrOTPRateLimited
	}

	expected := state.OTPHash
	actual := utils.HashOTP(state.NewEmail, otp, s.config.JWT.Secret)
	if subtle.ConstantTimeCompare([]byte(expected), []byte(actual)) != 1 {
		logger.Warn("Email change OTP invalid",
			zap.String("user_id", userID.String()),
			zap.Int64("attempts", attempts),
		)
		return "", utils.NewSafeError("invalid otp")
	}

	_ = cache.Client.Delete(key, attemptsKey)
	logger.Info("Email change OTP verified",
		zap.String("user_id", userID.String()),
		zap.String("new_email", state.NewEmail),
	)
	return state.NewEmail, nil
}
