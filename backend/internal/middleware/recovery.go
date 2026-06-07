package middleware

import (
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Recovery returns a gin middleware for recovering from panics
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Log the panic with request ID for traceability.
				logger.Ctx(c).Error("Panic recovered",
					zap.Any("error", err),
					zap.String("path", c.Request.URL.Path),
					zap.String("method", c.Request.Method),
				)

				// Return error response
				utils.InternalServerErrorResponse(c, "Internal server error")
				c.Abort()
			}
		}()

		c.Next()
	}
}
