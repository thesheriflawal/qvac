package handler

import (
	"crypto/hmac"
	"net/http"

	telegramclient "github.com/Kynettic-org/kynettic-backend/internal/clients/telegram"
	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/gin-gonic/gin"
)

// TelegramHandler receives Telegram webhook updates.
type TelegramHandler struct {
	botService    *service.TelegramBotService
	webhookSecret string // optional HMAC-SHA256 secret for request validation
}

// NewTelegramHandler constructs a TelegramHandler.
func NewTelegramHandler(cfg config.TelegramConfig, botService *service.TelegramBotService) *TelegramHandler {
	return &TelegramHandler{
		botService:    botService,
		webhookSecret: cfg.WebhookSecret,
	}
}

// HandleWebhook processes a Telegram update sent to the webhook endpoint.
// Telegram does not sign requests by default; the secret token header
// (X-Telegram-Bot-Api-Secret-Token) is checked when TELEGRAM_WEBHOOK_SECRET is set.
func (h *TelegramHandler) HandleWebhook(c *gin.Context) {
	if h.webhookSecret != "" {
		provided := c.GetHeader("X-Telegram-Bot-Api-Secret-Token")
		if !hmacEqual(provided, h.webhookSecret) {
			utils.ErrorResponse(c, http.StatusUnauthorized, "invalid webhook secret", nil)
			return
		}
	}

	var update telegramclient.Update
	if err := c.ShouldBindJSON(&update); err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "invalid update payload", err)
		return
	}

	h.botService.HandleUpdate(c.Request.Context(), update)
	c.Status(http.StatusOK)
}

// hmacEqual compares two strings in constant time to prevent timing attacks.
func hmacEqual(provided, secret string) bool {
	return hmac.Equal([]byte(provided), []byte(secret))
}
