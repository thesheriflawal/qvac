package handler

import (
	"net/http"
	"strconv"

	"github.com/Kynettic-org/kynettic-backend/internal/middleware"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
)

// ReferralHandler handles referral-related HTTP requests.
type ReferralHandler struct {
	referralService service.ReferralService
}

// NewReferralHandler creates a new ReferralHandler.
func NewReferralHandler(referralService service.ReferralService) *ReferralHandler {
	return &ReferralHandler{referralService: referralService}
}

// ---------------------------------------------------------------------------
// User-facing endpoints
// ---------------------------------------------------------------------------

// GetMyReferralInfo returns the authenticated user's referral code, stats, and eligibility.
// @Summary Get my referral info
// @Description Returns referral code, total referrals, points, and quarterly eligibility status.
// @Tags referral
// @Produce json
// @Security BearerAuth
// @Success 200 {object} utils.Response{data=service.ReferralInfo}
// @Failure 401 {object} utils.Response
// @Router /users/me/referral [get]
func (h *ReferralHandler) GetMyReferralInfo(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	info, err := h.referralService.GetMyReferralInfo(claims.UserID)
	if err != nil {
		logger.Ctx(c).Error("Failed to get referral info", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Referral info retrieved", info)
}

// ListMyReferrals returns a paginated list of users referred by the authenticated user.
// @Summary List my referrals
// @Description Returns paginated list of referred users.
// @Tags referral
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(10)
// @Success 200 {object} utils.PaginatedResponse
// @Failure 401 {object} utils.Response
// @Router /users/me/referrals [get]
func (h *ReferralHandler) ListMyReferrals(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	page, pageSize := parsePagination(c)

	entries, total, err := h.referralService.ListMyReferrals(claims.UserID, page, pageSize)
	if err != nil {
		logger.Ctx(c).Error("Failed to list referrals", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "Referrals retrieved", entries, pagination)
}

// ListMyPointTransactions returns a paginated point transaction history.
// @Summary List my referral point transactions
// @Description Returns paginated point accrual history.
// @Tags referral
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(10)
// @Success 200 {object} utils.PaginatedResponse
// @Failure 401 {object} utils.Response
// @Router /users/me/referral/points [get]
func (h *ReferralHandler) ListMyPointTransactions(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	page, pageSize := parsePagination(c)

	txs, total, err := h.referralService.ListMyPointTransactions(claims.UserID, page, pageSize)
	if err != nil {
		logger.Ctx(c).Error("Failed to list point transactions", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "Point transactions retrieved", txs, pagination)
}

// ClaimReward claims the user's referral reward for the open cycle.
// @Summary Claim referral reward
// @Description Claims fiat reward for the currently open claim cycle.
// @Tags referral
// @Produce json
// @Security BearerAuth
// @Param Idempotency-Key header string true "Unique idempotency key (UUID v4)"
// @Success 200 {object} utils.Response
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 409 {object} utils.Response "Duplicate request in progress"
// @Router /users/me/referral/claim [post]
func (h *ReferralHandler) ClaimReward(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	claim, err := h.referralService.ClaimReward(claims.UserID)
	if err != nil {
		logger.Ctx(c).Warn("Referral claim failed",
			zap.String("user_id", claims.UserID.String()),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Reward claimed successfully", map[string]interface{}{
		"id":             claim.ID,
		"points_claimed": claim.PointsClaimed,
		"fiat_amount":    utils.TruncateIfFiat(claim.FiatAmount, claim.Currency),
		"currency":       claim.Currency,
		"claimed_at":     claim.ClaimedAt,
	})
}

// ListMyClaims returns a paginated list of past claims.
// @Summary List my referral claims
// @Description Returns paginated claim history.
// @Tags referral
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(10)
// @Success 200 {object} utils.PaginatedResponse
// @Failure 401 {object} utils.Response
// @Router /users/me/referral/claims [get]
func (h *ReferralHandler) ListMyClaims(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	page, pageSize := parsePagination(c)

	claimList, total, err := h.referralService.ListMyClaims(claims.UserID, page, pageSize)
	if err != nil {
		logger.Ctx(c).Error("Failed to list claims", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "Claims retrieved", claimList, pagination)
}

// GetLeaderboard returns the top referrers for the current quarter.
// @Summary Get referral leaderboard
// @Description Returns top referrers ranked by points earned in the current quarter.
// @Tags referral
// @Produce json
// @Security BearerAuth
// @Param limit query int false "Number of entries" default(10)
// @Success 200 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Router /users/me/referral/leaderboard [get]
func (h *ReferralHandler) GetLeaderboard(c *gin.Context) {
	limit := 10
	if v := c.Query("limit"); v != "" {
		if l, err := strconv.Atoi(v); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	entries, err := h.referralService.GetLeaderboard(limit)
	if err != nil {
		logger.Ctx(c).Error("Failed to get leaderboard", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Leaderboard retrieved", entries)
}

// ---------------------------------------------------------------------------
// Admin endpoints
// ---------------------------------------------------------------------------

// AdminListAllReferrals returns a paginated list of all referrals.
// @Summary List all referrals (admin)
// @Description Admin endpoint to list all referral relationships, optionally filtered by status.
// @Tags referral-admin
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Param status query string false "Filter by status: pending, completed"
// @Success 200 {object} utils.PaginatedResponse
// @Failure 401 {object} utils.Response
// @Router /admin/referrals [get]
func (h *ReferralHandler) AdminListAllReferrals(c *gin.Context) {
	page, pageSize := parsePagination(c)
	status := c.Query("status")

	entries, total, err := h.referralService.AdminListAllReferrals(page, pageSize, status)
	if err != nil {
		logger.Ctx(c).Error("Failed to list all referrals", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "Referrals retrieved", entries, pagination)
}

// AdminListReferralsByUser returns a paginated list of referrals for a specific referrer.
// @Summary List referrals by user (admin)
// @Description Admin endpoint to list all referrals made by a specific user.
// @Tags referral-admin
// @Produce json
// @Security BearerAuth
// @Param user_id path string true "Referrer user ID"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Page size" default(20)
// @Success 200 {object} utils.PaginatedResponse
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Router /admin/referrals/user/{user_id} [get]
func (h *ReferralHandler) AdminListReferralsByUser(c *gin.Context) {
	userIDStr := c.Param("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "Invalid user ID", nil)
		return
	}

	page, pageSize := parsePagination(c)

	entries, total, err := h.referralService.AdminListReferralsByUser(userID, page, pageSize)
	if err != nil {
		logger.Ctx(c).Error("Failed to list referrals by user", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "Referrals retrieved", entries, pagination)
}

// ListReferralConfigs lists all referral config values.
// @Summary List referral configs
// @Description Admin endpoint to list all referral configuration values.
// @Tags referral-admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Router /admin/referral/config [get]
func (h *ReferralHandler) ListReferralConfigs(c *gin.Context) {
	cfgs, err := h.referralService.ListConfigs()
	if err != nil {
		logger.Ctx(c).Error("Failed to list referral configs", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Referral configs retrieved", cfgs)
}

// UpdateReferralConfigRequest represents the request body for updating a config key.
type UpdateReferralConfigRequest struct {
	Key   string `json:"key" binding:"required"`
	Value string `json:"value" binding:"required"`
}

// UpdateReferralConfig updates a referral config value.
// @Summary Update referral config
// @Description Admin endpoint to update a referral configuration value.
// @Tags referral-admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body UpdateReferralConfigRequest true "Config update"
// @Success 200 {object} utils.Response
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Router /admin/referral/config [put]
func (h *ReferralHandler) UpdateReferralConfig(c *gin.Context) {
	var req UpdateReferralConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := h.referralService.UpdateConfig(req.Key, req.Value); err != nil {
		logger.Ctx(c).Warn("Failed to update referral config", zap.Error(err))
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Config updated", nil)
}

// OpenClaimCycleRequest represents the request body for opening a claim cycle.
type OpenClaimCycleRequest struct {
	Quarter        string          `json:"quarter" binding:"required"`         // e.g. "2026-Q1"
	PoolAmountFiat decimal.Decimal `json:"pool_amount_fiat" binding:"required"`
	Currency       string          `json:"currency" binding:"required"`        // e.g. "NGN"
}

// OpenClaimCycle opens a new claim cycle for a quarter.
// @Summary Open claim cycle
// @Description Admin endpoint to open a claim cycle for a quarter with a fiat reward pool.
// @Tags referral-admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body OpenClaimCycleRequest true "Claim cycle params"
// @Success 201 {object} utils.Response
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Router /admin/referral/claim-cycles [post]
func (h *ReferralHandler) OpenClaimCycle(c *gin.Context) {
	var req OpenClaimCycleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	cycle, err := h.referralService.OpenClaimCycle(req.Quarter, req.PoolAmountFiat, req.Currency)
	if err != nil {
		logger.Ctx(c).Warn("Failed to open claim cycle", zap.Error(err))
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusCreated, "Claim cycle opened", cycle.ToResponse())
}

// ListClaimCycles lists all claim cycles.
// @Summary List claim cycles
// @Description Admin endpoint to list all referral claim cycles.
// @Tags referral-admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Router /admin/referral/claim-cycles [get]
func (h *ReferralHandler) ListClaimCycles(c *gin.Context) {
	cycles, err := h.referralService.ListClaimCycles()
	if err != nil {
		logger.Ctx(c).Error("Failed to list claim cycles", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	responses := make([]*models.ReferralClaimCycleResponse, 0, len(cycles))
	for i := range cycles {
		responses = append(responses, cycles[i].ToResponse())
	}

	utils.SuccessResponse(c, http.StatusOK, "Claim cycles retrieved", responses)
}

// CloseClaimCycle closes an open claim cycle.
// @Summary Close claim cycle
// @Description Admin endpoint to close a claim cycle.
// @Tags referral-admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "Claim cycle ID"
// @Success 200 {object} utils.Response
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Router /admin/referral/claim-cycles/{id} [patch]
func (h *ReferralHandler) CloseClaimCycle(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "Invalid claim cycle ID", nil)
		return
	}

	if err := h.referralService.CloseClaimCycle(id); err != nil {
		logger.Ctx(c).Warn("Failed to close claim cycle", zap.Error(err))
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Claim cycle closed", nil)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func parsePagination(c *gin.Context) (int, int) {
	page := 1
	pageSize := 10

	if v := c.Query("page"); v != "" {
		if p, err := strconv.Atoi(v); err == nil && p > 0 {
			page = p
		}
	}
	if v := c.Query("page_size"); v != "" {
		if ps, err := strconv.Atoi(v); err == nil && ps > 0 && ps <= 100 {
			pageSize = ps
		}
	}

	return page, pageSize
}
