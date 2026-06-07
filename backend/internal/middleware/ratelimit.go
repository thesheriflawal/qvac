package middleware

import (
	"fmt"
	"sync"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type visitor struct {
	lastSeen time.Time
	count    int
}

var (
	visitors = make(map[string]*visitor)
	mu       sync.RWMutex
)

// RateLimit returns a rate limiting middleware.
//
// It uses Redis-backed counters when Redis is enabled (for distributed rate limiting across
// instances) and falls back to an in-memory map when Redis is unavailable.
func RateLimit(cfg *config.Config) gin.HandlerFunc {
	// Cleanup old visitors periodically for in-memory fallback
	go cleanupVisitors(cfg.RateLimit.Duration)

	return func(c *gin.Context) {
		ip := c.ClientIP()

		// Prefer Redis-based distributed rate limiting when available.
		if cache.Client != nil && cache.GetClient() != nil {
			key := fmt.Sprintf("ratelimit:%s", ip)
			// Atomically increment and set TTL on first use via a Lua script,
			// preventing a permanent key if the process crashes between INCR and EXPIRE.
			count, err := cache.Client.IncrementWithExpiry(key, cfg.RateLimit.Duration)
			if err != nil {
				// On Redis error, fall back to in-memory logic
				goto inMemory
			}

			if count > int64(cfg.RateLimit.Requests) {
				logger.Ctx(c).Warn("Rate limit exceeded (Redis)",
					zap.String("ip", ip),
					zap.Int64("count", count),
				)
				utils.ErrorResponse(c, 429, "Rate limit exceeded. Please try again later.", nil)
				c.Abort()
				return
			}

			c.Next()
			return
		}

	inMemory:
		mu.Lock()
		v, exists := visitors[ip]

		if !exists {
			visitors[ip] = &visitor{
				lastSeen: time.Now(),
				count:    1,
			}
			mu.Unlock()
			c.Next()
			return
		}

		// Check if the time window has passed
		if time.Since(v.lastSeen) > cfg.RateLimit.Duration {
			v.lastSeen = time.Now()
			v.count = 1
			mu.Unlock()
			c.Next()
			return
		}

		// Increment count
		v.count++

		// Check if rate limit exceeded
		if v.count > cfg.RateLimit.Requests {
			mu.Unlock()
			logger.Ctx(c).Warn("Rate limit exceeded (in-memory)",
				zap.String("ip", ip),
				zap.Int("count", v.count),
			)
			utils.ErrorResponse(c, 429, "Rate limit exceeded. Please try again later.", nil)
			c.Abort()
			return
		}

		mu.Unlock()
		c.Next()
	}
}

// cleanupVisitors removes old visitor entries
func cleanupVisitors(duration time.Duration) {
	ticker := time.NewTicker(duration)
	defer ticker.Stop()

	for range ticker.C {
		mu.Lock()
		for ip, v := range visitors {
			if time.Since(v.lastSeen) > duration {
				delete(visitors, ip)
			}
		}
		mu.Unlock()
	}
}

// UserRateLimit returns a middleware that enforces a per-authenticated-user
// request limit over a sliding window. Intended for endpoints that proxy to
// paid third-party APIs (Nomba, Dojah, etc.) where per-IP limiting is
// insufficient because multiple users may share an IP (e.g., via NAT).
//
// When Redis is available the counter is atomic and shared across all instances.
// When Redis is unavailable the request is allowed through rather than blocking
// the user, which is consistent with the rest of the Redis-dependent guards.
func UserRateLimit(keyPrefix string, requests int, window time.Duration) gin.HandlerFunc {
	// In-memory fallback: per-user counters keyed by UUID.
	type memCounter struct {
		count     int
		windowEnd time.Time
	}
	var (
		counters   = make(map[uuid.UUID]*memCounter)
		countersMu sync.Mutex
	)

	// Periodic cleanup.
	go func() {
		ticker := time.NewTicker(window)
		defer ticker.Stop()
		for range ticker.C {
			countersMu.Lock()
			now := time.Now()
			for id, c := range counters {
				if now.After(c.windowEnd) {
					delete(counters, id)
				}
			}
			countersMu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		claims, err := GetUserFromContext(c)
		if err != nil || claims == nil {
			utils.UnauthorizedResponse(c, "Authentication required")
			c.Abort()
			return
		}
		userID := claims.UserID

		if cache.Client != nil && cache.GetClient() != nil {
			key := fmt.Sprintf("%s:%s", keyPrefix, userID.String())
			count, err := cache.Client.IncrementWithExpiry(key, window)
			if err != nil {
				// Redis error — let the request through rather than blocking the user.
				logger.Warn("UserRateLimit Redis error; proceeding without limit",
					zap.String("key", key),
					zap.Error(err),
				)
				c.Next()
				return
			}
			if count > int64(requests) {
				logger.Warn("User rate limit exceeded",
					zap.String("user_id", userID.String()),
					zap.String("key_prefix", keyPrefix),
					zap.Int64("count", count),
				)
				utils.ErrorResponse(c, 429, "Too many requests. Please try again later.", nil)
				c.Abort()
				return
			}
			c.Next()
			return
		}

		// In-memory fallback.
		countersMu.Lock()
		now := time.Now()
		entry, exists := counters[userID]
		if !exists || now.After(entry.windowEnd) {
			counters[userID] = &memCounter{count: 1, windowEnd: now.Add(window)}
			countersMu.Unlock()
			c.Next()
			return
		}
		entry.count++
		if entry.count > requests {
			countersMu.Unlock()
			logger.Warn("User rate limit exceeded (in-memory)",
				zap.String("user_id", userID.String()),
				zap.String("key_prefix", keyPrefix),
			)
			utils.ErrorResponse(c, 429, "Too many requests. Please try again later.", nil)
			c.Abort()
			return
		}
		countersMu.Unlock()
		c.Next()
	}
}

// IPRateLimit returns a middleware that enforces a per-IP request limit keyed by
// a caller-supplied prefix. Unlike the global RateLimit middleware (which shares
// one counter per IP across all routes), this allows tight, endpoint-specific
// limits on sensitive unauthenticated endpoints such as OTP verification.
//
// Uses Redis when available; falls back to in-memory.
func IPRateLimit(keyPrefix string, requests int, window time.Duration) gin.HandlerFunc {
	type memCounter struct {
		count     int
		windowEnd time.Time
	}
	var (
		counters   = make(map[string]*memCounter)
		countersMu sync.Mutex
	)

	go func() {
		ticker := time.NewTicker(window)
		defer ticker.Stop()
		for range ticker.C {
			countersMu.Lock()
			now := time.Now()
			for k, c := range counters {
				if now.After(c.windowEnd) {
					delete(counters, k)
				}
			}
			countersMu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()

		if cache.Client != nil && cache.GetClient() != nil {
			key := fmt.Sprintf("%s:%s", keyPrefix, ip)
			count, err := cache.Client.IncrementWithExpiry(key, window)
			if err != nil {
				logger.Warn("IPRateLimit Redis error; proceeding without limit",
					zap.String("key", key),
					zap.Error(err),
				)
				c.Next()
				return
			}
			if count > int64(requests) {
				logger.Warn("IP rate limit exceeded",
					zap.String("ip", ip),
					zap.String("key_prefix", keyPrefix),
					zap.Int64("count", count),
				)
				utils.ErrorResponse(c, 429, "Too many requests. Please try again later.", nil)
				c.Abort()
				return
			}
			c.Next()
			return
		}

		// In-memory fallback.
		countersMu.Lock()
		now := time.Now()
		entry, exists := counters[ip]
		if !exists || now.After(entry.windowEnd) {
			counters[ip] = &memCounter{count: 1, windowEnd: now.Add(window)}
			countersMu.Unlock()
			c.Next()
			return
		}
		entry.count++
		if entry.count > requests {
			countersMu.Unlock()
			logger.Warn("IP rate limit exceeded (in-memory)",
				zap.String("ip", ip),
				zap.String("key_prefix", keyPrefix),
			)
			utils.ErrorResponse(c, 429, "Too many requests. Please try again later.", nil)
			c.Abort()
			return
		}
		countersMu.Unlock()
		c.Next()
	}
}

// TransferCooldown enforces a cooldown period between transfer operations for a user
// to prevent double payments. Uses Redis when available, falls back to in-memory.
func TransferCooldown(cooldown time.Duration) gin.HandlerFunc {
	// In-memory fallback storage
	var (
		transferLocks   = make(map[uuid.UUID]time.Time)
		transferLocksMu sync.RWMutex
	)

	// Cleanup goroutine for in-memory fallback
	go func() {
		ticker := time.NewTicker(cooldown)
		defer ticker.Stop()
		for range ticker.C {
			transferLocksMu.Lock()
			now := time.Now()
			for userID, lastTransfer := range transferLocks {
				if now.Sub(lastTransfer) > cooldown {
					delete(transferLocks, userID)
				}
			}
			transferLocksMu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		// Get user from context (requires Auth middleware to run first)
		claims, err := GetUserFromContext(c)
		if err != nil || claims == nil {
			utils.UnauthorizedResponse(c, "Authentication required")
			c.Abort()
			return
		}

		userID := claims.UserID
		key := fmt.Sprintf("transfer_cooldown:%s", userID.String())

		// Try Redis first
		if cache.Client != nil && cache.GetClient() != nil {
			// SetNX returns true if key was set (no existing lock)
			set, err := cache.Client.SetNX(key, "1", cooldown)
			if err != nil {
				// Redis error, fall back to in-memory
				goto inMemory
			}

			if !set {
				// Key already exists - user is in cooldown
				ttl, _ := cache.Client.TTL(key)
				remaining := ttl.Seconds()
				if remaining < 0 {
					remaining = cooldown.Seconds()
				}
				utils.ErrorResponse(c, 429, fmt.Sprintf("Please wait %.0f seconds before making another transfer", remaining), nil)
				c.Abort()
				return
			}

			c.Next()
			return
		}

	inMemory:
		transferLocksMu.Lock()
		lastTransfer, exists := transferLocks[userID]

		if exists && time.Since(lastTransfer) < cooldown {
			remaining := cooldown - time.Since(lastTransfer)
			transferLocksMu.Unlock()
			utils.ErrorResponse(c, 429, fmt.Sprintf("Please wait %.0f seconds before making another transfer", remaining.Seconds()), nil)
			c.Abort()
			return
		}

		// Set the lock
		transferLocks[userID] = time.Now()
		transferLocksMu.Unlock()

		c.Next()
	}
}
