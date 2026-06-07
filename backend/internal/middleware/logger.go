package middleware

import (
	"time"

	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Logger returns a gin middleware for logging requests
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Calculate latency
		latency := time.Since(start)

		// Get status code
		statusCode := c.Writer.Status()

		// Build a request-scoped logger so every line includes the request ID.
		log := logger.Ctx(c)

		// Log request
		log.Info("HTTP Request",
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.String("query", query),
			zap.Int("status", statusCode),
			zap.Duration("latency", latency),
			zap.String("ip", c.ClientIP()),
			zap.String("user_agent", c.Request.UserAgent()),
		)

		// Log errors if any
		if len(c.Errors) > 0 {
			for _, e := range c.Errors {
				log.Error("Request error", zap.Error(e.Err))
			}
		}
	}
}
