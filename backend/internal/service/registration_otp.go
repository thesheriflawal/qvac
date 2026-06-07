package service

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"strings"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"go.uber.org/zap"
)

const (
	registrationOTPTTL            = 10 * time.Minute
	registrationOTPMinResend      = 60 * time.Second
	registrationOTPMaxSendsPerTTL = 3
	registrationOTPMaxVerifyTries = 5
	registrationTokenTTL          = 10 * time.Minute
	registrationTokenRandomBytes  = 32
)

type registrationOTPState struct {
	OTPHash    string    `json:"otp_hash"`
	ExpiresAt  time.Time `json:"expires_at"`
	SentCount  int       `json:"sent_count"`
	LastSentAt time.Time `json:"last_sent_at"`
}

func registrationOTPKey(email string) string {
	return "auth:regotp:" + email
}

func registrationOTPAttemptsKey(email string) string {
	return "auth:regotp:attempts:" + email
}

func registrationTokenKey(token string) string {
	return "auth:regtoken:" + token
}

func isKeyNotFoundErr(err error) bool {
	if err == nil {
		return false
	}
	return strings.HasPrefix(err.Error(), "key not found:")
}

func (s *authService) requireRedis() error {
	// cache.Initialize() leaves Client nil if REDIS_ENABLED=false.
	if cache.Client == nil || cache.GetClient() == nil {
		return utils.NewSafeError("redis is required for OTP registration")
	}
	return nil
}

func (s *authService) storeRegistrationOTP(email, otp string) error {
	if err := s.requireRedis(); err != nil {
		return err
	}

	now := time.Now().UTC()
	key := registrationOTPKey(email)

	// Load existing state (for resend rate limiting).
	var existing registrationOTPState
	err := cache.Client.GetJSON(key, &existing)
	if err != nil && !isKeyNotFoundErr(err) {
		return err
	}

	if err == nil {
		// Existing state found.
		if now.After(existing.ExpiresAt) {
			_ = cache.Client.Delete(key)
		} else {
			if now.Sub(existing.LastSentAt) < registrationOTPMinResend {
				return utils.NewSafeError("otp recently sent; please wait before requesting a new one")
			}
			if existing.SentCount >= registrationOTPMaxSendsPerTTL {
				return utils.NewSafeError("too many otp requests; please try again later")
			}
		}
	}

	sentCount := 1
	if err == nil && now.Before(existing.ExpiresAt) {
		sentCount = existing.SentCount + 1
	}

	state := registrationOTPState{
		OTPHash:    utils.HashOTP(email, otp, s.config.JWT.Secret),
		ExpiresAt:  now.Add(registrationOTPTTL),
		SentCount:  sentCount,
		LastSentAt: now,
	}

	// Reset the atomic attempt counter whenever a fresh OTP is issued.
	_ = cache.Client.Delete(registrationOTPAttemptsKey(email))

	return cache.Client.SetJSON(key, state, registrationOTPTTL)
}

func (s *authService) verifyRegistrationOTPAndIssueToken(email, otp string) (string, error) {
	if err := s.requireRedis(); err != nil {
		return "", err
	}

	now := time.Now().UTC()
	otpKey := registrationOTPKey(email)

	var state registrationOTPState
	if err := cache.Client.GetJSON(otpKey, &state); err != nil {
		if isKeyNotFoundErr(err) {
			return "", utils.NewSafeError("otp not found or expired")
		}
		return "", err
	}

	if now.After(state.ExpiresAt) {
		_ = cache.Client.Delete(otpKey)
		logger.Warn("Registration OTP verification failed: OTP expired",
			zap.String("email", email),
			zap.String("reason", "otp_expired"),
		)
		return "", utils.NewSafeError("otp not found or expired")
	}

	// Atomically increment the attempt counter. INCR is a single Redis
	// command, so concurrent requests each receive a distinct value and
	// cannot observe the same counter state simultaneously.
	attemptsKey := registrationOTPAttemptsKey(email)
	attempts, err := cache.Client.Increment(attemptsKey)
	if err != nil {
		return "", err
	}
	// Tie the counter's lifetime to the OTP window on first increment.
	if attempts == 1 {
		_ = cache.Client.Expire(attemptsKey, registrationOTPTTL)
	}
	if attempts > registrationOTPMaxVerifyTries {
		logger.Warn("Registration OTP verification failed: max attempts reached",
			zap.String("email", email),
			zap.Int64("attempts", attempts),
			zap.String("reason", "max_attempts_reached"),
		)
		return "", ErrOTPRateLimited
	}

	expected := state.OTPHash
	actual := utils.HashOTP(email, otp, s.config.JWT.Secret)
	if subtle.ConstantTimeCompare([]byte(expected), []byte(actual)) != 1 {
		logger.Warn("Registration OTP verification failed: invalid OTP",
			zap.String("email", email),
			zap.Int64("attempts", attempts),
			zap.String("reason", "invalid_otp"),
		)
		return "", utils.NewSafeError("invalid otp")
	}

	// OTP verified: delete OTP state and attempt counter, then issue a
	// short-lived registration token.
	_ = cache.Client.Delete(otpKey, attemptsKey)

	logger.Info("Registration OTP verified successfully",
		zap.String("email", email),
	)

	b := make([]byte, registrationTokenRandomBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(b)

	tokenKey := registrationTokenKey(token)
	if err := cache.Client.Set(tokenKey, email, registrationTokenTTL); err != nil {
		return "", err
	}

	return token, nil
}

func (s *authService) consumeRegistrationToken(registrationToken string) (string, error) {
	if err := s.requireRedis(); err != nil {
		return "", err
	}
	if strings.TrimSpace(registrationToken) == "" {
		return "", utils.NewSafeError("registration token is required")
	}

	key := registrationTokenKey(registrationToken)
	email, err := cache.Client.Get(key)
	if err != nil {
		if isKeyNotFoundErr(err) {
			return "", utils.NewSafeError("invalid or expired registration token")
		}
		return "", err
	}

	_ = cache.Client.Delete(key)
	return utils.NormalizeEmail(email), nil
}
