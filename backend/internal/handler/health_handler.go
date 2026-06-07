package handler

import (
	"net/http"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// HealthHandler handles health check requests
type HealthHandler struct{}

// NewHealthHandler creates a new health handler
func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Redis    string `json:"redis"`
}

// Check handles the health check endpoint
// @Summary Health check
// @Description Check the health status of the API and its dependencies (database, Redis)
// @Tags health
// @Accept json
// @Produce json
// @Success 200 {object} utils.Response{data=HealthResponse} "Service is healthy"
// @Failure 503 {object} utils.Response{data=HealthResponse} "Service is degraded"
// @Router /health [get]
func (h *HealthHandler) Check(c *gin.Context) {
	response := HealthResponse{
		Status:   "ok",
		Database: "ok",
		Redis:    "ok",
	}

	// Check database health
	if err := database.HealthCheck(); err != nil {
		response.Database = "error"
		response.Status = "degraded"
	}

	// Check Redis health
	if err := cache.HealthCheck(); err != nil {
		response.Redis = "error"
		response.Status = "degraded"
	}

	// Return error if any service is down
	if response.Status == "degraded" {
		logger.Ctx(c).Warn("Health check degraded",
			zap.String("database", response.Database),
			zap.String("redis", response.Redis),
		)
		utils.ErrorResponse(c, http.StatusServiceUnavailable, "Service unhealthy", response)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Service is healthy", response)
}
