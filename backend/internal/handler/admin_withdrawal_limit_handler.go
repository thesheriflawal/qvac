package handler

import (
	"net/http"

	"github.com/Kynettic-org/kynettic-backend/internal/middleware"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// AdminWithdrawalLimitHandler handles admin endpoints for per-user withdrawal limits.
type AdminWithdrawalLimitHandler struct {
	svc service.AdminWithdrawalLimitService
}

// NewAdminWithdrawalLimitHandler creates a new AdminWithdrawalLimitHandler.
func NewAdminWithdrawalLimitHandler(svc service.AdminWithdrawalLimitService) *AdminWithdrawalLimitHandler {
	return &AdminWithdrawalLimitHandler{svc: svc}
}

// GetUserLimit returns the withdrawal limit info for a user.
// @Summary Get user withdrawal limit (admin)
// @Description Admin-only: returns tier limit, custom override, today's usage, and remaining headroom.
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "User UUID"
// @Success 200 {object} utils.Response{data=service.UserLimitInfo}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Failure 404 {object} utils.Response
// @Router /admin/users/{id}/withdrawal-limit [get]
func (h *AdminWithdrawalLimitHandler) GetUserLimit(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "Invalid user ID", nil)
		return
	}

	info, err := h.svc.GetUserLimit(userID)
	if err != nil {
		logger.Ctx(c).Error("GetUserLimit failed", zap.String("user_id", userID.String()), zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Withdrawal limit retrieved", info)
}

type setOverrideRequest struct {
	LimitNGN int64 `json:"limit_ngn" binding:"required,min=1"`
}

// SetOverride creates or replaces the permanent custom daily withdrawal limit for a user.
// @Summary Set withdrawal limit override (admin)
// @Description Admin-only: permanently sets a custom daily NGN withdrawal limit for a user, overriding their tier default.
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id   path string             true "User UUID"
// @Param body body setOverrideRequest true "New limit"
// @Success 200 {object} utils.Response
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Router /admin/users/{id}/withdrawal-limit/override [post]
func (h *AdminWithdrawalLimitHandler) SetOverride(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "Invalid user ID", nil)
		return
	}

	admin, err := middleware.GetUserFromContext(c)
	if err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, "Unauthorized", nil)
		return
	}

	var req setOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "limit_ngn is required and must be > 0", nil)
		return
	}

	if err := h.svc.SetOverride(userID, admin.UserID, req.LimitNGN); err != nil {
		logger.Ctx(c).Error("SetOverride failed", zap.String("user_id", userID.String()), zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Withdrawal limit override set", nil)
}

// RemoveOverride deletes the custom limit, reverting the user to their tier default.
// @Summary Remove withdrawal limit override (admin)
// @Description Admin-only: removes the custom daily withdrawal limit for a user, reverting to their KYC tier default.
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "User UUID"
// @Success 200 {object} utils.Response
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Router /admin/users/{id}/withdrawal-limit/override [delete]
func (h *AdminWithdrawalLimitHandler) RemoveOverride(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "Invalid user ID", nil)
		return
	}

	if err := h.svc.RemoveOverride(userID); err != nil {
		logger.Ctx(c).Error("RemoveOverride failed", zap.String("user_id", userID.String()), zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Withdrawal limit override removed", nil)
}
