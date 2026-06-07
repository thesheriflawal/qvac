package handler

import (
	"net/http"
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type AdminReferenceHandler struct {
	networkRepo  repository.NetworkRepository
	currencyRepo repository.CurrencyRepository
}

func NewAdminReferenceHandler(networkRepo repository.NetworkRepository, currencyRepo repository.CurrencyRepository) *AdminReferenceHandler {
	return &AdminReferenceHandler{networkRepo: networkRepo, currencyRepo: currencyRepo}
}

type CreateNetworkRequest struct {
	Name        string `json:"name" binding:"required"`
	ChainKey    string `json:"chain_key" binding:"required"`
	NetworkType string `json:"network_type" binding:"required,oneof=mainnet testnet"`
	ChainID     int64  `json:"chain_id" binding:"required"`
	IsActive    *bool  `json:"is_active"`
}

type CreateCurrencyRequest struct {
	Symbol   string `json:"symbol" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Decimals int    `json:"decimals" binding:"required"`
	IsNative *bool  `json:"is_native"`

	// Optional Blockradar asset ID for crypto withdrawals (UUID-like).
	AssetID string `json:"asset_id"`

	// Optional CoinGecko coin ID for price fetching (e.g., "tether", "ethereum").
	CoinGeckoID string `json:"coingecko_id"`
}

// CreateNetwork upserts a network row.
// @Summary Create/update network
// @Description Admin-only: create or update a network (upsert by chain_key + network_type).
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateNetworkRequest true "Network"
// @Success 201 {object} utils.Response{data=models.Network}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Router /admin/networks [post]
func (h *AdminReferenceHandler) CreateNetwork(c *gin.Context) {
	var req CreateNetworkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	n := &models.Network{
		Name:        strings.TrimSpace(req.Name),
		ChainKey:    strings.ToLower(strings.TrimSpace(req.ChainKey)),
		NetworkType: strings.ToLower(strings.TrimSpace(req.NetworkType)),
		ChainID:     req.ChainID,
		IsActive:    isActive,
	}

	if err := h.networkRepo.Upsert(n); err != nil {
		logger.Ctx(c).Error("Admin network upsert failed",
			zap.String("chain_key", n.ChainKey),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Admin network saved", zap.String("chain_key", n.ChainKey))
	utils.SuccessResponse(c, http.StatusCreated, "Network saved", n)
}

// CreateCurrency upserts a currency row.
// @Summary Create/update currency
// @Description Admin-only: create or update a currency (upsert by symbol).
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateCurrencyRequest true "Currency"
// @Success 201 {object} utils.Response{data=models.Currency}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Router /admin/currencies [post]
func (h *AdminReferenceHandler) CreateCurrency(c *gin.Context) {
	var req CreateCurrencyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	isNative := false
	if req.IsNative != nil {
		isNative = *req.IsNative
	}

	cur := &models.Currency{
		Symbol:      strings.ToUpper(strings.TrimSpace(req.Symbol)),
		Name:        strings.TrimSpace(req.Name),
		Decimals:    req.Decimals,
		IsNative:    isNative,
		AssetID:     strings.TrimSpace(req.AssetID),
		CoinGeckoID: strings.ToLower(strings.TrimSpace(req.CoinGeckoID)),
	}

	if err := h.currencyRepo.Upsert(cur); err != nil {
		logger.Ctx(c).Error("Admin currency upsert failed",
			zap.String("symbol", cur.Symbol),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Admin currency saved", zap.String("symbol", cur.Symbol))
	utils.SuccessResponse(c, http.StatusCreated, "Currency saved", cur)
}
