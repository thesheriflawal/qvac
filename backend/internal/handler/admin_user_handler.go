package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/middleware"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// AdminUserHandler handles admin user management endpoints.
type AdminUserHandler struct {
	adminUserService service.AdminUserService
	p2pService       service.P2PService
}

// NewAdminUserHandler creates a new AdminUserHandler.
func NewAdminUserHandler(svc service.AdminUserService, p2pService service.P2PService) *AdminUserHandler {
	return &AdminUserHandler{adminUserService: svc, p2pService: p2pService}
}

// adminSecurityView is a safe projection of UserSecurity that omits secrets.
type adminSecurityView struct {
	PinEnabled           bool      `json:"pin_enabled"`
	TwoFAEnabled         bool      `json:"twofa_enabled"`
	NotificationsEnabled bool      `json:"notifications_enabled"`
	LastPinChange        time.Time `json:"last_pin_change"`
}

// adminUserDetailResponse is the full response payload for GET /admin/users/:id.
type adminUserDetailResponse struct {
	User               *models.UserResponse       `json:"user"`
	Profile            models.UserProfile         `json:"profile"`
	Security           adminSecurityView          `json:"security"`
	KYC                *models.KYCStatusResponse  `json:"kyc"`
	Wallets            []models.WalletResponse    `json:"wallets"`
	RecentTransactions []models.WalletTransaction `json:"recent_transactions"`
	TxTotal            int64                      `json:"tx_total"`
}

// ListUsers returns a paginated, filterable list of users.
// @Summary List users (admin)
// @Description Admin-only: paginated user list with optional filters.
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param page       query int    false "Page number (default 1)"
// @Param page_size  query int    false "Page size (default 10, max 100)"
// @Param email      query string false "Email substring (case-insensitive)"
// @Param uid        query string false "Exact 14-digit UID"
// @Param kyc_tier   query int    false "KYC tier (0-3)"
// @Param is_active  query bool   false "Active status"
// @Param has_2fa    query bool   false "2FA enabled"
// @Success 200 {object} utils.Response{data=[]models.UserResponse}
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Router /admin/users [get]
func (h *AdminUserHandler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	filters := repository.AdminUserFilters{
		Email: c.Query("email"),
		UID:   c.Query("uid"),
	}

	if v := c.Query("kyc_tier"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			tier := models.KYCTier(n)
			filters.KYCTier = &tier
		}
	}
	if v := c.Query("is_active"); v != "" {
		b := v == "true"
		filters.IsActive = &b
	}
	if v := c.Query("has_2fa"); v != "" {
		b := v == "true"
		filters.Has2FA = &b
	}

	users, total, err := h.adminUserService.SearchUsers(filters, page, pageSize)
	if err != nil {
		logger.Ctx(c).Error("Admin ListUsers failed", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	responses := make([]*models.UserResponse, len(users))
	for i := range users {
		responses[i] = users[i].ToResponse()
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "Users retrieved successfully", responses, pagination)
}

// GetUserDetail returns full detail for a single user.
// @Summary Get user detail (admin)
// @Description Admin-only: full user profile, security state, KYC, wallets, recent transactions.
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "User UUID"
// @Success 200 {object} utils.Response{data=adminUserDetailResponse}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Failure 404 {object} utils.Response
// @Router /admin/users/{id} [get]
func (h *AdminUserHandler) GetUserDetail(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ValidationErrorResponse(c, "invalid user id")
		return
	}

	detail, err := h.adminUserService.GetUserDetail(id)
	if err != nil {
		if err.Error() == "user not found" {
			utils.ErrorResponse(c, http.StatusNotFound, "User not found", nil)
			return
		}
		logger.Ctx(c).Error("Admin GetUserDetail failed", zap.String("user_id", id.String()), zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	var kycResp *models.KYCStatusResponse
	if detail.KYC != nil {
		kycResp = detail.KYC.ToStatusResponse()
	}

	resp := adminUserDetailResponse{
		User:    detail.User.ToResponse(),
		Profile: detail.User.Profile,
		Security: adminSecurityView{
			PinEnabled:           detail.User.Security.PinEnabled,
			TwoFAEnabled:         detail.User.Security.TwoFAEnabled,
			NotificationsEnabled: detail.User.Security.NotificationsEnabled,
			LastPinChange:        detail.User.Security.LastPinChange,
		},
		KYC:                kycResp,
		Wallets: func() []models.WalletResponse {
			resp := make([]models.WalletResponse, len(detail.User.Wallets))
			for i := range detail.User.Wallets {
				resp[i] = detail.User.Wallets[i].ToResponse()
			}
			return resp
		}(),
		RecentTransactions: detail.RecentTxs,
		TxTotal:            detail.TxTotal,
	}

	utils.SuccessResponse(c, http.StatusOK, "User detail retrieved successfully", resp)
}

// SetUserStatusRequest is the request body for PATCH /admin/users/:id/status.
type SetUserStatusRequest struct {
	IsActive bool `json:"is_active"`
}

// SetUserStatus activates or deactivates a user account.
// @Summary Set user active status (admin)
// @Description Admin-only: activate or deactivate a user. Deactivating immediately invalidates all sessions.
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id      path string              true "User UUID"
// @Param request body SetUserStatusRequest true "Status"
// @Success 200 {object} utils.Response
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Failure 404 {object} utils.Response
// @Router /admin/users/{id}/status [patch]
func (h *AdminUserHandler) SetUserStatus(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ValidationErrorResponse(c, "invalid user id")
		return
	}

	if id == claims.UserID {
		utils.ErrorResponse(c, http.StatusBadRequest, "Cannot change your own active status", nil)
		return
	}

	var req SetUserStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := h.adminUserService.SetActiveStatus(id, req.IsActive); err != nil {
		if err.Error() == "user not found" {
			utils.ErrorResponse(c, http.StatusNotFound, "User not found", nil)
			return
		}
		logger.Ctx(c).Error("Admin SetUserStatus failed", zap.String("user_id", id.String()), zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	logger.Ctx(c).Info("Admin updated user status",
		zap.String("target_user_id", id.String()),
		zap.Bool("is_active", req.IsActive),
	)
	utils.SuccessResponse(c, http.StatusOK, "User status updated", nil)
}

// ListTopTraders returns users ranked by completed P2P trade count.
// @Summary List top P2P traders (admin)
// @Description Admin-only: paginated list of users ranked by number of completed P2P trades, with total volume.
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param page      query int    false "Page number (default 1)"
// @Param page_size query int    false "Page size (default 20, max 100)"
// @Param currency  query string false "Filter by crypto symbol (e.g. USDT)"
// @Success 200 {object} utils.PaginatedResponse
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Router /admin/p2p/top-traders [get]
func (h *AdminUserHandler) ListTopTraders(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	currency := strings.ToUpper(strings.TrimSpace(c.Query("currency")))

	traders, total, err := h.p2pService.GetTopTraders(currency, page, pageSize)
	if err != nil {
		logger.Ctx(c).Error("Admin ListTopTraders failed", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "Top traders retrieved", traders, pagination)
}

// ListAdminOrders returns all P2P orders with optional filters.
// @Summary List all P2P orders (admin)
// @Description Admin-only: paginated list of all P2P orders, filterable by status, currency, user, and date range.
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param page      query int    false "Page number (default 1)"
// @Param page_size query int    false "Page size (default 10, max 100)"
// @Param status    query string false "Order status: pending, paid, disputed, cancelled, completed"
// @Param currency  query string false "Crypto currency symbol (e.g. USDT)"
// @Param user_id   query string false "Filter orders where user is buyer or seller (UUID)"
// @Param from      query string false "Start date filter (RFC3339, e.g. 2026-01-01T00:00:00Z)"
// @Param to        query string false "End date filter (RFC3339, e.g. 2026-12-31T23:59:59Z)"
// @Success 200 {object} utils.PaginatedResponse{data=[]service.AdminP2POrderResponse} "Orders retrieved successfully"
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Failure 500 {object} utils.Response
// @Router /admin/p2p/orders [get]
func (h *AdminUserHandler) ListAdminOrders(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	filter := service.AdminOrderFilter{
		Status:   strings.ToLower(strings.TrimSpace(c.Query("status"))),
		Currency: strings.ToUpper(strings.TrimSpace(c.Query("currency"))),
	}

	if userIDStr := strings.TrimSpace(c.Query("user_id")); userIDStr != "" {
		uid, err := uuid.Parse(userIDStr)
		if err != nil {
			utils.ValidationErrorResponse(c, "invalid user_id format")
			return
		}
		filter.UserID = uid
	}

	if from := strings.TrimSpace(c.Query("from")); from != "" {
		filter.From = &from
	}
	if to := strings.TrimSpace(c.Query("to")); to != "" {
		filter.To = &to
	}

	orders, total, err := h.p2pService.ListAllOrders(c.Request.Context(), filter, page, pageSize)
	if err != nil {
		logger.Ctx(c).Error("Admin ListAdminOrders failed", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "Orders retrieved successfully", orders, pagination)
}

