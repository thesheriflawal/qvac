package middleware

import (
	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORS returns a CORS middleware configured from config.
//
// In production, we apply a safer default by disallowing wildcard origins ("*") and
// requiring explicitly configured origins. This aligns with the security audit
// recommendation to avoid overly permissive CORS.
func CORS(cfg *config.Config) gin.HandlerFunc {
	corsConfig := cors.Config{
		AllowOrigins:     cfg.CORS.AllowedOrigins,
		AllowMethods:     cfg.CORS.AllowedMethods,
		AllowHeaders:     cfg.CORS.AllowedHeaders,
		ExposeHeaders:    []string{"Content-Length", "Idempotency-Key"},
		AllowCredentials: true,
	}

	if cfg.IsProduction() {
		// Strip wildcard origins in production; only explicit origins are allowed.
		filtered := make([]string, 0, len(corsConfig.AllowOrigins))
		for _, o := range corsConfig.AllowOrigins {
			if o == "*" {
				continue
			}
			filtered = append(filtered, o)
		}
		corsConfig.AllowOrigins = filtered
	}

	return cors.New(corsConfig)
}
