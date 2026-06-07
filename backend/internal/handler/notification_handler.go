package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/middleware"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// NotificationHandler handles HTTP requests related to notifications.
type NotificationHandler struct {
	notificationService service.NotificationService
}

// NewNotificationHandler creates a new NotificationHandler.
func NewNotificationHandler(notificationService service.NotificationService) *NotificationHandler {
	return &NotificationHandler{notificationService: notificationService}
}

// BroadcastNotificationRequest represents the request body for broadcasting a notification.
type BroadcastNotificationRequest struct {
	Title   string `json:"title" validate:"required,min=1,max=255"`
	Message string `json:"message" validate:"required"`
}

// ListMyNotifications lists notifications for the currently authenticated user.
// @Summary List my notifications
// @Description List notifications for the authenticated user
// @Tags notifications
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param status query string false "Filter by status" Enums(unread,all) default(all)
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Items per page" default(10)
// @Success 200 {object} utils.PaginatedResponse{data=[]models.NotificationResponse} "Notifications retrieved successfully"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /users/me/notifications [get]
func (h *NotificationHandler) ListMyNotifications(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	status := c.DefaultQuery("status", "all")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	notifications, total, err := h.notificationService.ListUserNotifications(claims.UserID, status, page, pageSize)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	resp := make([]*models.NotificationResponse, len(notifications))
	for i := range notifications {
		resp[i] = notifications[i].ToResponse()
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "Notifications retrieved successfully", resp, pagination)
}

// MarkNotificationAsRead marks a single notification as read for the current user.
// @Summary Mark notification as read
// @Description Mark a specific notification as read for the authenticated user
// @Tags notifications
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Notification ID"
// @Success 200 {object} utils.Response "Notification marked as read"
// @Failure 400 {object} utils.Response "Invalid notification ID"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 404 {object} utils.Response "Notification not found"
// @Router /users/me/notifications/{id}/read [patch]
func (h *NotificationHandler) MarkNotificationAsRead(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "Invalid notification ID", nil)
		return
	}

	if err := h.notificationService.MarkNotificationRead(claims.UserID, id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.Contains(strings.ToLower(err.Error()), "not found") {
			utils.NotFoundResponse(c, "Notification not found")
			return
		}
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Notification marked as read", nil)
}

// MarkAllNotificationsAsRead marks all unread notifications as read for the current user.
// @Summary Mark all notifications as read
// @Description Mark all unread notifications as read for the authenticated user
// @Tags notifications
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} utils.Response "Notifications marked as read"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /users/me/notifications/read-all [patch]
func (h *NotificationHandler) MarkAllNotificationsAsRead(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	updated, err := h.notificationService.MarkAllNotificationsRead(claims.UserID)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Notifications marked as read", gin.H{"updated": updated})
}

// Broadcast broadcasts a notification to all users (admin only, routed via /admin group).
// @Summary Broadcast notification to all users
// @Description Create a notification for every user in the system (admin only)
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body BroadcastNotificationRequest true "Broadcast notification details"
// @Success 201 {object} utils.Response "Notification broadcasted successfully"
// @Failure 400 {object} utils.Response "Validation error"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 403 {object} utils.Response "Admin access required"
// @Failure 500 {object} utils.Response "Failed to broadcast notification"
// @Router /admin/notifications/broadcast [post]
func (h *NotificationHandler) Broadcast(c *gin.Context) {
	var req BroadcastNotificationRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := h.notificationService.BroadcastNotification(req.Title, req.Message); err != nil {
		logger.Ctx(c).Error("Broadcast notification failed", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	logger.Ctx(c).Info("Notification broadcasted", zap.String("title", req.Title))
	utils.SuccessResponse(c, http.StatusCreated, "Notification broadcasted successfully", nil)
}
