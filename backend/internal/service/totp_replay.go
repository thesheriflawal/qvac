package service

import (
	"fmt"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// totpReplayWindow is the duration for which a consumed TOTP code is remembered.
// With Period=30s and Skew=1 the server accepts codes from t-30 to t+30, giving
// a maximum code lifetime of 90 seconds.
const totpReplayWindow = 90 * time.Second

// ConsumeTOTPCode marks a TOTP code as used for the given user and returns an
// error if the code was already consumed within the replay window. It must be
// called AFTER ValidateTOTPCode confirms the code is cryptographically valid —
// consuming an invalid code would waste a valid slot unnecessarily.
//
// Fails closed: if Redis is unavailable the authentication attempt is blocked.
// TOTP replay protection is a security control and must not be silently skipped.
func ConsumeTOTPCode(userID uuid.UUID, code string) error {
	if cache.Client == nil {
		logger.Error("TOTP replay protection unavailable: Redis client is nil",
			zap.String("user_id", userID.String()),
		)
		return utils.NewSafeError("authentication service temporarily unavailable")
	}

	key := fmt.Sprintf("totp:used:%s:%s", userID.String(), code)

	// SetNX returns true if the key was newly created (first use).
	// false means the key already exists — the code was already consumed.
	set, err := cache.Client.SetNX(key, "1", totpReplayWindow)
	if err != nil {
		logger.Error("TOTP replay check failed: Redis error; blocking authentication",
			zap.String("user_id", userID.String()),
			zap.Error(err),
		)
		return utils.NewSafeError("authentication service temporarily unavailable")
	}

	if !set {
		logger.Warn("TOTP replay attempt detected",
			zap.String("user_id", userID.String()),
		)
		return utils.NewSafeError("authenticator code has already been used")
	}

	return nil
}
