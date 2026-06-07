package handler

import (
	"net/http"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AdminRevenueHandler handles admin revenue reporting endpoints.
type AdminRevenueHandler struct {
	revenueService service.AdminRevenueService
}

// NewAdminRevenueHandler creates a new AdminRevenueHandler.
func NewAdminRevenueHandler(svc service.AdminRevenueService) *AdminRevenueHandler {
	return &AdminRevenueHandler{revenueService: svc}
}

// parseDateRange parses ?from and ?to query params as YYYY-MM-DD dates (UTC).
// Defaults to the last 30 days when omitted. Returns the start of `from` day
// and the start of the day after `to` (exclusive upper bound).
func parseDateRange(c *gin.Context) (from, to time.Time, err error) {
	now := time.Now().UTC()
	defaultFrom := now.AddDate(0, 0, -29).Truncate(24 * time.Hour)
	defaultTo := now.Truncate(24*time.Hour).AddDate(0, 0, 1)

	fromStr := c.Query("from")
	toStr := c.Query("to")

	if fromStr == "" {
		from = defaultFrom
	} else {
		from, err = time.ParseInLocation("2006-01-02", fromStr, time.UTC)
		if err != nil {
			return
		}
	}

	if toStr == "" {
		to = defaultTo
	} else {
		var t time.Time
		t, err = time.ParseInLocation("2006-01-02", toStr, time.UTC)
		if err != nil {
			return
		}
		to = t.AddDate(0, 0, 1) // make upper bound exclusive
	}
	return
}

// GetSummary returns total platform fee balances and order stats for a period.
// @Summary Revenue summary (admin)
// @Description Admin-only: lifetime fee balances per currency and order stats for the given date range (default last 30 days).
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param from query string false "Start date YYYY-MM-DD (default: 30 days ago)"
// @Param to   query string false "End date YYYY-MM-DD inclusive (default: today)"
// @Success 200 {object} utils.Response{data=service.RevenueSummary}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Router /admin/revenue/summary [get]
func (h *AdminRevenueHandler) GetSummary(c *gin.Context) {
	from, to, err := parseDateRange(c)
	if err != nil {
		utils.ValidationErrorResponse(c, "invalid date format, use YYYY-MM-DD")
		return
	}

	summary, err := h.revenueService.GetSummary(from, to)
	if err != nil {
		logger.Ctx(c).Error("Admin GetRevenueSummary failed", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Revenue summary retrieved successfully", summary)
}

// GetDailyFees returns day-by-day fee totals for a given period.
// @Summary Daily fee breakdown (admin)
// @Description Admin-only: fee totals grouped by day and currency. Default last 30 days.
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param from     query string false "Start date YYYY-MM-DD (default: 30 days ago)"
// @Param to       query string false "End date YYYY-MM-DD inclusive (default: today)"
// @Param currency query string false "Filter by currency symbol (e.g. USDT)"
// @Success 200 {object} utils.Response{data=[]repository.DailyFeeRow}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Router /admin/revenue/fees [get]
func (h *AdminRevenueHandler) GetDailyFees(c *gin.Context) {
	from, to, err := parseDateRange(c)
	if err != nil {
		utils.ValidationErrorResponse(c, "invalid date format, use YYYY-MM-DD")
		return
	}

	currency := c.Query("currency")
	rows, err := h.revenueService.GetDailyFees(from, to, currency)
	if err != nil {
		logger.Ctx(c).Error("Admin GetDailyFees failed", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Daily fees retrieved successfully", rows)
}
