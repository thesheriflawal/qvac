package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/middleware"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
)

// P2PHandler handles P2P-related HTTP endpoints.
type P2PHandler struct {
	p2pService   service.P2PService
	priceService service.PriceService
	currencyRepo repository.CurrencyRepository
	feePercent   decimal.Decimal
}

// P2PAdView is the API representation of a P2P ad with computed effective price.
type P2PAdView struct {
	models.P2PAd
	// EffectivePrice is the current effective price for this ad.
	// For fixed pricing, this is the same as Price.
	// For relative pricing, this is the current market price adjusted by RelativePercent.
	EffectivePrice string `json:"effective_price"`
}

// P2POrderView is the API representation of a P2P order for the authenticated
// user. It embeds the core P2POrder model and adds a user-relative side field
// indicating whether the user bought or sold crypto in this order.
type P2POrderView struct {
	models.P2POrder
	// Side is from the perspective of the authenticated user: "buy" if the
	// user bought crypto in this order, "sell" if they sold crypto.
	Side string `json:"side"`
	// FeeAmount and FeeCurrency are the taker fee for this order — the fee
	// charged to the party who created the order (executed against the ad).
	FeeAmount   decimal.Decimal `json:"fee_amount"`
	FeeCurrency string          `json:"fee_currency"`
}

// NewP2PHandler creates a new P2PHandler.
func NewP2PHandler(p2pService service.P2PService, priceService service.PriceService, currencyRepo repository.CurrencyRepository, feePercent decimal.Decimal) *P2PHandler {
	return &P2PHandler{
		p2pService:   p2pService,
		priceService: priceService,
		currencyRepo: currencyRepo,
		feePercent:   feePercent,
	}
}

// GetFees returns the current P2P trade fee percentage.
// @Summary Get P2P fees
// @Description Returns the platform fee percentage charged per P2P trade.
// @Tags p2p
// @Produce json
// @Security BearerAuth
// @Success 200 {object} utils.Response
// @Router /p2p/fees [get]
func (h *P2PHandler) GetFees(c *gin.Context) {
	utils.SuccessResponse(c, http.StatusOK, "P2P fee retrieved successfully", gin.H{
		"fee_percent": h.feePercent,
	})
}

// CreateP2PAdRequest represents the payload for creating a new P2P ad.
//
// Note: currency is now referenced by ID (from the reference currencies table)
// instead of by symbol in the request body.
type CreateP2PAdRequest struct {
	Type            string    `json:"type" validate:"required,oneof=buy sell"`
	CurrencyID      uuid.UUID `json:"currency_id" validate:"required"`
	Price           string    `json:"price" validate:"omitempty"` // Required only for price_type=fixed
	PriceType       string    `json:"price_type" validate:"required"`
	RelativePercent string    `json:"relative_percent" validate:"omitempty"` // Required only for price_type=relative
	RolloverEnabled bool      `json:"rollover_enabled"`
	TotalQuantity   string    `json:"total_quantity" validate:"omitempty"`
	MinAmount       string    `json:"min_amount" validate:"required"`
	IsPrivate *bool `json:"is_private" validate:"omitempty"`
	// 6-digit transaction PIN.
	Pin string `json:"pin" validate:"required,len=6"`
}

// ExecuteP2PTradeRequest represents the payload for executing a P2P trade
// against an existing ad. The caller provides their raw input amount and which
// currency it is denominated in; the server derives the other side.
type ExecuteP2PTradeRequest struct {
	AdID uuid.UUID `json:"ad_id" validate:"required"`
	// The amount the user wants to trade, expressed in input_currency.
	AmountInput string `json:"amount_input" validate:"required"`
	// "fiat" or "crypto" — which side amount_input is denominated in.
	InputCurrency string `json:"input_currency" validate:"required,oneof=fiat crypto"`
	// 6-digit transaction PIN.
	Pin string `json:"pin" validate:"required,len=6"`
}

// UpdateP2PAdRequest represents the payload for updating an existing P2P ad.
// All fields except pin are optional; only provided fields will be updated.
type UpdateP2PAdRequest struct {
	Price           *string `json:"price,omitempty"`
	PriceType       *string `json:"price_type,omitempty"`
	RelativePercent *string `json:"relative_percent,omitempty"`
	TotalQuantity   *string `json:"total_quantity,omitempty"`
	MinAmount       *string `json:"min_amount,omitempty"`
	IsPrivate       *bool   `json:"is_private,omitempty"`
	Status          *string `json:"status,omitempty"` // active, paused, closed
	// 6-digit transaction PIN.
	Pin string `json:"pin" validate:"required,len=6"`
}

// compile-time references to models used only in Swagger annotations.
var (
	_ = models.P2PAd{}
	_ = models.P2POrder{}
)

// convertAdToView converts a P2PAd to P2PAdView with computed effective price.
func (h *P2PHandler) convertAdToView(c *gin.Context, ad models.P2PAd) (P2PAdView, error) {
	view := P2PAdView{
		P2PAd: ad,
	}

	// For fixed pricing, use the stored price
	if strings.ToLower(strings.TrimSpace(ad.PriceType)) == "fixed" {
		view.EffectivePrice = ad.Price.StringFixed(2)
		return view, nil
	}

	// For relative pricing, calculate the effective price
	currency, err := h.currencyRepo.FindBySymbol(ad.Currency)
	if err != nil {
		// If currency not found or error, return zero price
		view.EffectivePrice = "0.00"
		return view, nil
	}

	effectivePrice, err := h.priceService.CalculateEffectivePrice(c.Request.Context(), &ad, currency)
	if err != nil {
		// If price calculation fails, return zero price
		view.EffectivePrice = "0.00"
		return view, nil
	}

	view.EffectivePrice = effectivePrice.StringFixed(2)
	return view, nil
}

// ListAds returns paginated P2P ads.
// @Summary List P2P ads
// @Description Retrieve a paginated list of P2P ads with computed effective prices, optionally filtered by type and currency. When mine_only=true, only the authenticated user's ads are returned. For relative pricing ads, effective_price is calculated based on current market price.
// @Tags p2p
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param type query string false "Ad type (buy or sell)"
// @Param currency_id query int false "Crypto currency ID (reference currencies.id)"
// @Param mine_only query bool false "If true, only return my ads"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Items per page" default(10)
// @Success 200 {object} utils.PaginatedResponse{data=[]handler.P2PAdView} "P2P ads retrieved successfully"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /p2p/ads [get]
func (h *P2PHandler) ListAds(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	adType := strings.ToLower(strings.TrimSpace(c.Query("type")))
	currencyIDStr := strings.TrimSpace(c.Query("currency_id"))
	mineOnlyStr := strings.TrimSpace(c.Query("mine_only"))
	mineOnly := mineOnlyStr == "true" || mineOnlyStr == "1"

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	var currencyID uuid.UUID
	if currencyIDStr != "" {
		parsed, err := uuid.Parse(currencyIDStr)
		if err != nil {
			utils.ValidationErrorResponse(c, "currency_id must be a valid UUID")
			return
		}
		currencyID = parsed
	}

	ads, total, err := h.p2pService.ListAds(c.Request.Context(), claims.UserID, adType, currencyID, mineOnly, page, pageSize)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	// Convert ads to views with effective prices
	adViews := make([]P2PAdView, len(ads))
	for i, ad := range ads {
		view, _ := h.convertAdToView(c, ad)
		adViews[i] = view
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "P2P ads retrieved successfully", adViews, pagination)
}

// CreateAd creates a new P2P ad for the authenticated user.
// @Summary Create P2P ad
// @Description Create a new P2P ad (buy or sell) with pricing mode, rollover, limits, and privacy options.
// @Tags p2p
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateP2PAdRequest true "Ad details"
// @Success 201 {object} utils.Response{data=interface{}} "P2P ad created successfully"
// @Failure 400 {object} utils.Response "Invalid request or insufficient balance"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /p2p/ads [post]
func (h *P2PHandler) CreateAd(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req CreateP2PAdRequest
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

	logger.Ctx(c).Info("Create P2P ad request body",
		zap.String("type", req.Type),
		zap.String("currency_id", req.CurrencyID.String()),
		zap.String("price", req.Price),
		zap.String("price_type", req.PriceType),
		zap.String("relative_percent", req.RelativePercent),
		zap.Bool("rollover_enabled", req.RolloverEnabled),
		zap.String("total_quantity", req.TotalQuantity),
		zap.String("min_amount", req.MinAmount),
		zap.Any("is_private", req.IsPrivate),
	)
	// Validate price_type specific requirements
	priceType := strings.ToLower(strings.TrimSpace(req.PriceType))
	if priceType == "" {
		priceType = "fixed"
	}

	var price decimal.Decimal
	var relativePercent decimal.Decimal

	if priceType == "fixed" {
		// For fixed pricing, price is required and relative_percent should not be set
		if strings.TrimSpace(req.Price) == "" {
			utils.ValidationErrorResponse(c, "price is required for fixed pricing")
			return
		}
		if strings.TrimSpace(req.RelativePercent) != "" {
			utils.ValidationErrorResponse(c, "relative_percent should not be set for fixed pricing")
			return
		}
		var err error
		price, err = decimal.NewFromString(strings.TrimSpace(req.Price))
		if err != nil {
			utils.ValidationErrorResponse(c, "invalid price format")
			return
		}
		if !price.IsPositive() {
			utils.ValidationErrorResponse(c, "price must be greater than zero")
			return
		}
	} else if priceType == "relative" {
		// For relative pricing, relative_percent is required and price should not be set
		if strings.TrimSpace(req.RelativePercent) == "" {
			utils.ValidationErrorResponse(c, "relative_percent is required for relative pricing")
			return
		}
		if strings.TrimSpace(req.Price) != "" {
			utils.ValidationErrorResponse(c, "price should not be set for relative pricing; use relative_percent instead")
			return
		}
		var err error
		relativePercent, err = decimal.NewFromString(strings.TrimSpace(req.RelativePercent))
		if err != nil {
			utils.ValidationErrorResponse(c, "invalid relative_percent format")
			return
		}
		if relativePercent.IsZero() {
			utils.ValidationErrorResponse(c, "relative_percent must be non-zero")
			return
		}
	} else {
		utils.ValidationErrorResponse(c, "price_type must be 'fixed' or 'relative'")
		return
	}

	minAmount, err := decimal.NewFromString(strings.TrimSpace(req.MinAmount))
	if err != nil {
		utils.ValidationErrorResponse(c, "invalid min_amount format")
		return
	}
	if !minAmount.IsPositive() {
		utils.ValidationErrorResponse(c, "min_amount must be greater than zero")
		return
	}

	var totalQuantity decimal.Decimal
	if !req.RolloverEnabled {
		if strings.TrimSpace(req.TotalQuantity) == "" {
			utils.ValidationErrorResponse(c, "total_quantity is required when rollover_enabled is false")
			return
		}
		totalQuantity, err = decimal.NewFromString(strings.TrimSpace(req.TotalQuantity))
		if err != nil {
			utils.ValidationErrorResponse(c, "invalid total_quantity format")
			return
		}
		if !totalQuantity.IsPositive() {
			utils.ValidationErrorResponse(c, "total_quantity must be greater than zero")
			return
		}
	}

	isPrivate := false
	if req.IsPrivate != nil {
		isPrivate = *req.IsPrivate
	}

	input := service.CreateAdInput{
		Type:            req.Type,
		CurrencyID:      req.CurrencyID,
		Price:           price,
		PriceType:       req.PriceType,
		RelativePercent: relativePercent,
		MinAmount:       minAmount,
		RolloverEnabled: req.RolloverEnabled,
		TotalQuantity:   totalQuantity,
		IsPrivate:       isPrivate,
		Pin:             req.Pin,
	}

	ad, err := h.p2pService.CreateAd(c.Request.Context(), claims.UserID, input)
	if err != nil {
		var pinErr *service.ErrPINRateLimited
		if errors.As(err, &pinErr) {
			c.Header("Retry-After", strconv.FormatInt(int64(pinErr.RetryAfter.Seconds()), 10))
			utils.ErrorResponse(c, http.StatusLocked, "Too many failed PIN attempts. Please try again later.", nil)
			return
		}
		logger.Ctx(c).Warn("P2P ad creation failed",
			zap.String("user_id", claims.UserID.String()),
			zap.String("type", req.Type),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("P2P ad created",
		zap.String("user_id", claims.UserID.String()),
		zap.String("ad_id", ad.ID.String()),
		zap.String("type", req.Type),
	)
	utils.SuccessResponse(c, http.StatusCreated, "P2P ad created successfully", ad)
}

// UpdateAd updates an existing P2P ad owned by the authenticated user.
// @Summary Update P2P ad
// @Description Update mutable fields of a P2P ad you own (price, limits, privacy, status).
// @Tags p2p
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Ad ID"
// @Param request body UpdateP2PAdRequest true "Ad fields to update"
// @Success 200 {object} utils.Response{data=models.P2PAd} "P2P ad updated successfully"
// @Failure 400 {object} utils.Response "Invalid request"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 404 {object} utils.Response "Ad not found"
// @Router /p2p/ads/{id} [patch]
func (h *P2PHandler) UpdateAd(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	idStr := strings.TrimSpace(c.Param("id"))
	id, err := uuid.Parse(idStr)
	if err != nil {
		utils.ValidationErrorResponse(c, "invalid ad id")
		return
	}

	var req UpdateP2PAdRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	// Parse optional decimal fields.
	var price *decimal.Decimal
	if req.Price != nil {
		p, err := decimal.NewFromString(strings.TrimSpace(*req.Price))
		if err != nil {
			utils.ValidationErrorResponse(c, "invalid price format")
			return
		}
		if !p.IsPositive() {
			utils.ValidationErrorResponse(c, "price must be greater than zero")
			return
		}
		price = &p
	}

	var relPct *decimal.Decimal
	if req.RelativePercent != nil {
		r, err := decimal.NewFromString(strings.TrimSpace(*req.RelativePercent))
		if err != nil {
			utils.ValidationErrorResponse(c, "invalid relative_percent format")
			return
		}
		if !r.IsPositive() {
			utils.ValidationErrorResponse(c, "relative_percent must be greater than zero")
			return
		}
		relPct = &r
	}

	var minAmount *decimal.Decimal
	if req.MinAmount != nil {
		m, err := decimal.NewFromString(strings.TrimSpace(*req.MinAmount))
		if err != nil {
			utils.ValidationErrorResponse(c, "invalid min_amount format")
			return
		}
		if !m.IsPositive() {
			utils.ValidationErrorResponse(c, "min_amount must be greater than zero")
			return
		}
		minAmount = &m
	}

	var totalQty *decimal.Decimal
	if req.TotalQuantity != nil {
		q, err := decimal.NewFromString(strings.TrimSpace(*req.TotalQuantity))
		if err != nil {
			utils.ValidationErrorResponse(c, "invalid total_quantity format")
			return
		}
		if !q.IsPositive() {
			utils.ValidationErrorResponse(c, "total_quantity must be greater than zero")
			return
		}
		totalQty = &q
	}

	input := service.UpdateAdInput{
		Price:           price,
		PriceType:       req.PriceType,
		RelativePercent: relPct,
		TotalQuantity:   totalQty,
		MinAmount:       minAmount,
		IsPrivate:       req.IsPrivate,
		Status:          req.Status,
		Pin:             req.Pin,
	}

	ad, err := h.p2pService.UpdateAd(c.Request.Context(), claims.UserID, id, input)
	if err != nil {
		var pinErr *service.ErrPINRateLimited
		if errors.As(err, &pinErr) {
			c.Header("Retry-After", strconv.FormatInt(int64(pinErr.RetryAfter.Seconds()), 10))
			utils.ErrorResponse(c, http.StatusLocked, "Too many failed PIN attempts. Please try again later.", nil)
			return
		}
		if strings.Contains(err.Error(), "ad not found") {
			utils.ErrorResponse(c, http.StatusNotFound, utils.SanitizeServiceError(err), nil)
			return
		}
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "P2P ad updated successfully", ad)
}

// DeleteAd deletes an existing P2P ad owned by the authenticated user.
// @Summary Delete P2P ad
// @Description Delete a P2P ad you own.
// @Tags p2p
// @Produce json
// @Security BearerAuth
// @Param id path int true "Ad ID"
// @Success 204 "P2P ad deleted successfully"
// @Failure 400 {object} utils.Response "Invalid request"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 404 {object} utils.Response "Ad not found"
// @Router /p2p/ads/{id} [delete]
func (h *P2PHandler) DeleteAd(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	idStr := strings.TrimSpace(c.Param("id"))
	id, err := uuid.Parse(idStr)
	if err != nil {
		utils.ValidationErrorResponse(c, "invalid ad id")
		return
	}

	if err := h.p2pService.DeleteAd(c.Request.Context(), claims.UserID, id); err != nil {
		if strings.Contains(err.Error(), "ad not found") {
			utils.ErrorResponse(c, http.StatusNotFound, utils.SanitizeServiceError(err), nil)
			return
		}
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	c.Status(http.StatusNoContent)
}

// ExecuteTrade executes a P2P trade (buy or sell) against an existing ad for the
// authenticated user. It debits the user's fiat or crypto wallet and credits
// the corresponding asset based on the ad type.
// @Summary Execute P2P trade
// @Description Execute an automated P2P trade (buy or sell) using an existing ad; funds are moved between on-platform fiat and crypto wallets.
// @Tags p2p
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param Idempotency-Key header string true "Unique idempotency key (UUID v4)"
// @Param request body ExecuteP2PTradeRequest true "Trade details"
// @Success 201 {object} utils.Response{data=P2POrderView} "P2P trade executed successfully"
// @Failure 400 {object} utils.Response "Invalid request or insufficient balance"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 409 {object} utils.Response "Duplicate request in progress"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /p2p/orders [post]
func (h *P2PHandler) ExecuteTrade(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req ExecuteP2PTradeRequest
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

	amountInput, err := decimal.NewFromString(strings.TrimSpace(req.AmountInput))
	if err != nil {
		utils.ValidationErrorResponse(c, "invalid amount_input format")
		return
	}
	if !amountInput.IsPositive() {
		utils.ValidationErrorResponse(c, "amount_input must be greater than zero")
		return
	}

	input := service.ExecuteTradeInput{
		AdID:          req.AdID,
		AmountInput:   amountInput,
		InputCurrency: req.InputCurrency,
		Pin:           req.Pin,
	}

	order, err := h.p2pService.ExecuteTrade(c.Request.Context(), claims.UserID, input)
	if err != nil {
		var pinErr *service.ErrPINRateLimited
		if errors.As(err, &pinErr) {
			c.Header("Retry-After", strconv.FormatInt(int64(pinErr.RetryAfter.Seconds()), 10))
			utils.ErrorResponse(c, http.StatusLocked, "Too many failed PIN attempts. Please try again later.", nil)
			return
		}
		logger.Ctx(c).Warn("P2P trade execution failed",
			zap.String("user_id", claims.UserID.String()),
			zap.String("ad_id", req.AdID.String()),
			zap.String("amount_input", req.AmountInput),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	// Compute user-relative side: if the authenticated user is the buyer,
	// they bought crypto in this order; otherwise they sold crypto.
	side := "sell"
	if order.BuyerID == claims.UserID {
		side = "buy"
	}

	view := P2POrderView{
		P2POrder:    *order,
		Side:        side,
		FeeAmount:   order.TakerFeeAmount,
		FeeCurrency: order.TakerFeeCurrency,
	}

	logger.Ctx(c).Info("P2P trade executed",
		zap.String("user_id", claims.UserID.String()),
		zap.String("order_id", order.ID.String()),
		zap.String("ad_id", req.AdID.String()),
	)
	utils.SuccessResponse(c, http.StatusCreated, "P2P trade executed successfully", view)
}

// ListMyAds returns paginated P2P ads
// active, paused, and closed ads.
// @Summary List my P2P ads
// @Description Retrieve a paginated list of P2P ads created by the authenticated user, optionally filtered by type, currency, and status.
// @Tags p2p
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param type query string false "Ad type (buy or sell)"
// @Param currency_id query int false "Crypto currency ID (reference currencies.id)"
// @Param status query string false "Ad status (active, paused, closed)"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Items per page" default(10)
// @Success 200 {object} utils.PaginatedResponse{data=[]models.P2PAd} "My P2P ads retrieved successfully"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /p2p/my-ads [get]
func (h *P2PHandler) ListMyAds(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	adType := strings.ToLower(strings.TrimSpace(c.Query("type")))
	currencyIDStr := strings.TrimSpace(c.Query("currency_id"))
	statusFilter := strings.ToLower(strings.TrimSpace(c.Query("status")))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	var currencyID uuid.UUID
	if currencyIDStr != "" {
		parsed, err := uuid.Parse(currencyIDStr)
		if err != nil {
			utils.ValidationErrorResponse(c, "currency_id must be a valid UUID")
			return
		}
		currencyID = parsed
	}

	ads, total, err := h.p2pService.ListUserAds(c.Request.Context(), claims.UserID, adType, currencyID, statusFilter, page, pageSize)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "My P2P ads retrieved successfully", ads, pagination)
}

// ListMyOrders returns paginated P2P orders where the authenticated user is
// either the buyer or the seller.
// @Summary List my P2P orders
// @Description Retrieve a paginated list of P2P orders where the authenticated user is buyer or seller.
// @Tags p2p
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param currency_id query int false "Crypto currency ID (reference currencies.id)"
// @Param status query string false "Order status (pending, completed, cancelled, etc.)"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Items per page" default(10)
// @Success 200 {object} utils.PaginatedResponse{data=[]P2POrderView} "P2P orders retrieved successfully"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /p2p/orders [get]
func (h *P2PHandler) ListMyOrders(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	currencyIDStr := strings.TrimSpace(c.Query("currency_id"))
	statusFilter := strings.ToLower(strings.TrimSpace(c.Query("status")))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	var currencyID uuid.UUID
	if currencyIDStr != "" {
		parsed, err := uuid.Parse(currencyIDStr)
		if err != nil {
			utils.ValidationErrorResponse(c, "currency_id must be a valid UUID")
			return
		}
		currencyID = parsed
	}

	orders, total, err := h.p2pService.ListUserOrders(c.Request.Context(), claims.UserID, currencyID, statusFilter, page, pageSize)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	// Map orders to user-relative views with side = buy/sell from the
	// authenticated user's perspective.
	views := make([]P2POrderView, 0, len(orders))
	for _, o := range orders {
		side := "sell"
		if o.BuyerID == claims.UserID {
			side = "buy"
		}
		views = append(views, P2POrderView{
			P2POrder:    o,
			Side:        side,
			FeeAmount:   o.TakerFeeAmount,
			FeeCurrency: o.TakerFeeCurrency,
		})
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "P2P orders retrieved successfully", views, pagination)
}
