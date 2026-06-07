package middleware

import (
	"crypto/rand"
	"fmt"

	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
)

const (
	// RequestIDKey is the Gin context key and HTTP response header for request IDs.
	RequestIDKey = "X-Request-ID"
)

// RequestID returns a middleware that assigns a unique ID to every request.
// The ID is generated server-side, stored in the Gin context, and echoed back
// in the X-Request-ID response header so callers can correlate logs.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := newUUID()

		c.Set(RequestIDKey, id)
		c.Header(RequestIDKey, id)
		c.Request = c.Request.WithContext(logger.ContextWithRequestID(c.Request.Context(), id))

		c.Next()
	}
}

// GetRequestID extracts the request ID from the Gin context.
func GetRequestID(c *gin.Context) string {
	if id, ok := c.Get(RequestIDKey); ok {
		if s, ok := id.(string); ok {
			return s
		}
	}
	return ""
}

// newUUID generates a RFC-4122 version-4 UUID using crypto/rand.
func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant RFC 4122
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
