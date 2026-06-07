package middleware

import (
	"fmt"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

const (
	UserContextKey = "user"
)

// Auth returns a middleware that validates JWT tokens
func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		// Extract token from header
		tokenString, err := utils.ExtractTokenFromHeader(authHeader)
		if err != nil {
			logger.Ctx(c).Warn("Invalid authorization header",
				zap.String("ip", c.ClientIP()),
			)
			utils.UnauthorizedResponse(c, "Invalid authorization header")
			c.Abort()
			return
		}

	// Validate token
	claims, err := utils.ValidateToken(tokenString, cfg.JWT.Secret)
	if err != nil {
		logger.Ctx(c).Warn("Invalid or expired token",
			zap.String("ip", c.ClientIP()),
			zap.Error(err),
		)
		utils.UnauthorizedResponse(c, "Invalid or expired token")
		c.Abort()
		return
	}

	// Validate that the session is still active (if the token carries session info).
	if claims.SessionID != "" {
		if cache.Client == nil {
			// Redis is disabled or not yet connected — fall back to trusting the JWT.
			logger.Ctx(c).Warn("Redis unavailable, session freshness not verified — trusting JWT",
				zap.String("user_id", claims.UserID.String()),
			)
		} else {
			key := fmt.Sprintf("session:%s:%s", claims.UserID.String(), claims.DeviceType)
			active, err := cache.Client.Get(key)
			if err != nil {
				if cache.IsNotFound(err) {
					// Key is gone — session has genuinely expired or was invalidated.
					logger.Ctx(c).Warn("Session expired",
						zap.String("user_id", claims.UserID.String()),
						zap.String("device_type", claims.DeviceType),
					)
					utils.UnauthorizedResponse(c, "Session expired, please log in again")
					c.Abort()
					return
				}
				// Redis infrastructure error — fall back to trusting the JWT rather than
				// locking out every authenticated user during an outage.
				logger.Ctx(c).Warn("Redis error during session check, trusting JWT",
					zap.String("user_id", claims.UserID.String()),
					zap.Error(err),
				)
			} else if active != claims.SessionID {
				// Key exists but belongs to a different session (e.g. logged in elsewhere).
				logger.Ctx(c).Warn("Session ID mismatch",
					zap.String("user_id", claims.UserID.String()),
					zap.String("device_type", claims.DeviceType),
				)
				utils.UnauthorizedResponse(c, "Session expired, please log in again")
				c.Abort()
				return
			} else {
				// Valid session — reset the inactivity timer.
				_ = cache.Client.Expire(key, cfg.Session.InactivityTimeout)
			}
		}
	}

	// Store user info in context
	c.Set(UserContextKey, claims)
	c.Next()
	}
}

// RequireRole returns a middleware that checks if user has required role
func RequireRole(roles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user from context
		userClaims, exists := c.Get(UserContextKey)
		if !exists {
			utils.UnauthorizedResponse(c, "Authentication required")
			c.Abort()
			return
		}

		claims, ok := userClaims.(*utils.JWTClaims)
		if !ok {
			utils.UnauthorizedResponse(c, "Invalid user data")
			c.Abort()
			return
		}

		// Check if user has required role
		userRole := models.UserRole(claims.Role)
		hasRole := false
		for _, role := range roles {
			if userRole == role {
				hasRole = true
				break
			}
		}

		if !hasRole {
		logger.Ctx(c).Warn("Insufficient permissions",
			zap.String("user_id", claims.UserID.String()),
			zap.String("role", claims.Role),
		)
			utils.ForbiddenResponse(c, "Insufficient permissions")
			c.Abort()
			return
		}

		c.Next()
	}
}

// GetUserFromContext retrieves user claims from context
func GetUserFromContext(c *gin.Context) (*utils.JWTClaims, error) {
	userClaims, exists := c.Get(UserContextKey)
	if !exists {
		return nil, nil
	}

	claims, ok := userClaims.(*utils.JWTClaims)
	if !ok {
		return nil, nil
	}

	return claims, nil
}

// OptionalAuth is a middleware that extracts user info if token is present but doesn't require it
func OptionalAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		if authHeader == "" {
			c.Next()
			return
		}

		// Extract token from header
		tokenString, err := utils.ExtractTokenFromHeader(authHeader)
		if err != nil {
			c.Next()
			return
		}

		// Validate token
		claims, err := utils.ValidateToken(tokenString, cfg.JWT.Secret)
		if err != nil {
			c.Next()
			return
		}

		// Store user info in context
		c.Set(UserContextKey, claims)
		c.Next()
	}
}
