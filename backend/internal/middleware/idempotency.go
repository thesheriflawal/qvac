package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

const (
	// IdempotencyKeyHeader is the HTTP header clients must set.
	IdempotencyKeyHeader = "Idempotency-Key"

	// idempotencyTTL is how long a completed (cached) response is kept.
	idempotencyTTL = 24 * time.Hour

	// idempotencyProcessingTTL is the TTL for the in-flight processing sentinel.
	// Using a short window (2 minutes) means a server crash or kill -9 will
	// automatically release the lock rather than blocking retries for 24 hours.
	// The sentinel is overwritten with the full 24-hour TTL once the response
	// is stored, so successful requests are still deduplicated for 24 hours.
	idempotencyProcessingTTL = 2 * time.Minute

	// idempotencyProcessing is a sentinel stored while the request is in flight
	// to prevent concurrent duplicates.
	idempotencyProcessing = "__processing__"

	// memMaxEntries is the hard cap on the in-memory fallback map.
	// Entries beyond this limit are dropped and the request is processed
	// without idempotency rather than risking an OOM crash. This only applies
	// when Redis is unavailable; Redis is the authoritative store in production.
	memMaxEntries = 10_000
)

// cachedResponse is the JSON-serialisable structure stored in Redis / memory.
type cachedResponse struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers"`
	Body       []byte            `json:"body"`
}

// Idempotency returns a Gin middleware that enforces idempotent requests.
//
// The client must supply the Idempotency-Key header with a valid UUID. If the
// same key (scoped to the authenticated user) has been seen before within the
// TTL window, the original response is replayed without executing the handler
// again.
func Idempotency() gin.HandlerFunc {
	// In-memory fallback when Redis is unavailable.
	var (
		mem   = make(map[string]*memEntry)
		memMu sync.Mutex
	)

	// Periodic cleanup of expired in-memory entries.
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			memMu.Lock()
			now := time.Now()
			for k, v := range mem {
				if now.After(v.expiresAt) {
					delete(mem, k)
				}
			}
			memMu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		// 1. Extract and validate the idempotency key.
		rawKey := c.GetHeader(IdempotencyKeyHeader)
		if rawKey == "" {
			utils.ErrorResponse(c, http.StatusBadRequest, "Idempotency-Key header is required for this request", nil)
			c.Abort()
			return
		}

		if _, err := uuid.Parse(rawKey); err != nil {
			utils.ErrorResponse(c, http.StatusBadRequest, "Idempotency-Key must be a valid UUID", nil)
			c.Abort()
			return
		}

		// 2. Scope the key to the authenticated user.
		claims, err := GetUserFromContext(c)
		if err != nil || claims == nil {
			utils.UnauthorizedResponse(c, "Authentication required")
			c.Abort()
			return
		}
		cacheKey := fmt.Sprintf("idempotency:%s:%s", claims.UserID.String(), rawKey)

		// 3. Try to fetch or acquire the key.
		if cache.Client != nil && cache.GetClient() != nil {
			if replay := tryRedis(c, cacheKey); replay {
				return
			}
		} else {
			if replay := tryMemory(c, cacheKey, mem, &memMu); replay {
				return
			}
		}

		// 4. Wrap the response writer so we can capture the response.
		w := &responseCapture{ResponseWriter: c.Writer, body: &bytes.Buffer{}}
		c.Writer = w

		// If a panic (or any other early exit) prevents us from storing the
		// final response, release the processing lock so clients can retry
		// rather than being locked out for 24 hours.
		stored := false
		defer func() {
			if !stored {
				if cache.Client != nil && cache.GetClient() != nil {
					_ = cache.Client.Delete(cacheKey)
				} else {
					memMu.Lock()
					delete(mem, cacheKey)
					memMu.Unlock()
				}
			}
		}()

		c.Next()

		// 5. Store the response.
		resp := cachedResponse{
			StatusCode: w.Status(),
			Headers:    captureHeaders(w),
			Body:       w.body.Bytes(),
		}

		if cache.Client != nil && cache.GetClient() != nil {
			storeRedis(cacheKey, &resp)
		} else {
			storeMemory(cacheKey, &resp, mem, &memMu)
		}
		stored = true
	}
}

// ---------------------------------------------------------------------------
// Redis helpers
// ---------------------------------------------------------------------------

func tryRedis(c *gin.Context, key string) (replayed bool) {
	// Try to acquire the key atomically with a short TTL for the processing
	// sentinel so a server crash doesn't lock clients out for 24 hours.
	set, err := cache.Client.SetNX(key, idempotencyProcessing, idempotencyProcessingTTL)
	if err != nil {
		// Redis error — let the request through.
		logger.Warn("Idempotency Redis SetNX failed; proceeding without idempotency", zap.Error(err))
		return false
	}

	if set {
		// First time seeing this key; proceed.
		return false
	}

	// Key exists — either still processing or completed.
	raw, err := cache.Client.Get(key)
	if err != nil {
		logger.Warn("Idempotency Redis Get failed", zap.Error(err))
		return false
	}

	if raw == idempotencyProcessing {
		// Another request with the same key is in flight.
		utils.ErrorResponse(c, http.StatusConflict, "A request with this Idempotency-Key is already being processed", nil)
		c.Abort()
		return true
	}

	// Replay the cached response.
	var resp cachedResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		logger.Warn("Idempotency: failed to unmarshal cached response", zap.Error(err))
		return false
	}

	replayResponse(c, &resp)
	return true
}

func storeRedis(key string, resp *cachedResponse) {
	data, err := json.Marshal(resp)
	if err != nil {
		logger.Warn("Idempotency: failed to marshal response for Redis", zap.Error(err))
		return
	}
	if err := cache.Client.Set(key, string(data), idempotencyTTL); err != nil {
		logger.Warn("Idempotency: failed to store response in Redis", zap.Error(err))
	}
}

// ---------------------------------------------------------------------------
// In-memory helpers
// ---------------------------------------------------------------------------

type memEntry struct {
	value     *cachedResponse
	expiresAt time.Time
}

func tryMemory(c *gin.Context, key string, mem map[string]*memEntry, mu *sync.Mutex) (replayed bool) {
	mu.Lock()
	entry, exists := mem[key]

	if !exists {
		// Acquire the slot with a processing sentinel — but only if we have room.
		if len(mem) >= memMaxEntries {
			mu.Unlock()
			logger.Warn("Idempotency in-memory map at capacity; rejecting request to prevent bypass")
			utils.ErrorResponse(c, http.StatusServiceUnavailable, "Service temporarily unavailable. Please retry your request.", nil)
			c.Abort()
			return true
		}
		mem[key] = &memEntry{value: nil, expiresAt: time.Now().Add(idempotencyProcessingTTL)}
		mu.Unlock()
		return false
	}

	// Entry exists and not expired.
	if time.Now().After(entry.expiresAt) {
		// Expired — treat as new. Re-check capacity before re-acquiring.
		if len(mem) >= memMaxEntries {
			mu.Unlock()
			logger.Warn("Idempotency in-memory map at capacity; rejecting request to prevent bypass")
			utils.ErrorResponse(c, http.StatusServiceUnavailable, "Service temporarily unavailable. Please retry your request.", nil)
			c.Abort()
			return true
		}
		mem[key] = &memEntry{value: nil, expiresAt: time.Now().Add(idempotencyProcessingTTL)}
		mu.Unlock()
		return false
	}

	if entry.value == nil {
		// Still processing.
		mu.Unlock()
		utils.ErrorResponse(c, http.StatusConflict, "A request with this Idempotency-Key is already being processed", nil)
		c.Abort()
		return true
	}

	resp := entry.value
	mu.Unlock()

	replayResponse(c, resp)
	return true
}

func storeMemory(key string, resp *cachedResponse, mem map[string]*memEntry, mu *sync.Mutex) {
	mu.Lock()
	defer mu.Unlock()
	if entry, ok := mem[key]; ok {
		entry.value = resp
	} else if len(mem) < memMaxEntries {
		mem[key] = &memEntry{value: resp, expiresAt: time.Now().Add(idempotencyTTL)}
	} else {
		logger.Warn("Idempotency in-memory map at capacity; response not cached")
	}
}

// ---------------------------------------------------------------------------
// Response capture & replay
// ---------------------------------------------------------------------------

// responseCapture wraps gin.ResponseWriter to also buffer the body.
type responseCapture struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *responseCapture) Write(data []byte) (int, error) {
	w.body.Write(data) // capture
	return w.ResponseWriter.Write(data)
}

func captureHeaders(w *responseCapture) map[string]string {
	headers := make(map[string]string)
	for k := range w.Header() {
		headers[k] = w.Header().Get(k)
	}
	return headers
}

func replayResponse(c *gin.Context, resp *cachedResponse) {
	for k, v := range resp.Headers {
		c.Header(k, v)
	}
	c.Data(resp.StatusCode, resp.Headers["Content-Type"], resp.Body)
	c.Abort()
}
