package handler

import (
	"net/http"

	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ReferenceHandler struct {
	currencyRepo repository.CurrencyRepository
	networkRepo  repository.NetworkRepository
	priceService service.PriceService
	feeService   service.FeeService
}

func NewReferenceHandler(currencyRepo repository.CurrencyRepository, networkRepo repository.NetworkRepository, priceService service.PriceService, feeService service.FeeService) *ReferenceHandler {
	return &ReferenceHandler{
		currencyRepo: currencyRepo,
		networkRepo:  networkRepo,
		priceService: priceService,
		feeService:   feeService,
	}
}

// ListCurrencies returns all configured currencies.
// @Summary List currencies
// @Description Public: list configured currencies.
// @Tags reference
// @Accept json
// @Produce json
// @Success 200 {object} utils.Response{data=[]models.Currency}
// @Router /currencies [get]
func (h *ReferenceHandler) ListCurrencies(c *gin.Context) {
	currencies, err := h.currencyRepo.List()
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}
	utils.SuccessResponse(c, http.StatusOK, "Currencies retrieved", currencies)
}

// ListNetworks returns active networks.
// @Summary List networks
// @Description Public: list active networks.
// @Tags reference
// @Accept json
// @Produce json
// @Success 200 {object} utils.Response{data=[]models.Network}
// @Router /networks [get]
func (h *ReferenceHandler) ListNetworks(c *gin.Context) {
	networks, err := h.networkRepo.ListActive()
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}
	utils.SuccessResponse(c, http.StatusOK, "Networks retrieved", networks)
}

// ListCurrencyNetworks returns the supported networks for a given currency.
// @Summary List supported networks for a currency
// @Description Public: list active blockchain networks that support a specific currency.
// @Tags reference
// @Accept json
// @Produce json
// @Param currency_id path string true "Currency ID (UUID)"
// @Success 200 {object} utils.Response{data=[]models.Network}
// @Failure 400 {object} utils.Response
// @Failure 404 {object} utils.Response
// @Router /currencies/{currency_id}/networks [get]
func (h *ReferenceHandler) ListCurrencyNetworks(c *gin.Context) {
	currencyIDStr := c.Param("currency_id")
	currencyID, err := uuid.Parse(currencyIDStr)
	if err != nil {
		utils.ValidationErrorResponse(c, "Invalid currency ID")
		return
	}

	// Verify currency exists.
	if _, err := h.currencyRepo.FindByID(currencyID); err != nil {
		utils.ErrorResponse(c, http.StatusNotFound, "Currency not found", nil)
		return
	}

	networks, err := h.networkRepo.ListByCurrency(currencyID)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}
	utils.SuccessResponse(c, http.StatusOK, "Supported networks retrieved", networks)
}

// GetCurrencyPrice returns the current price of a cryptocurrency in NGN.
// @Summary Get currency price in NGN
// @Description Public: get the current market price of a cryptocurrency in Nigerian Naira (NGN) from CoinGecko.
// @Tags reference
// @Accept json
// @Produce json
// @Param currency_id path int true "Currency ID"
// @Success 200 {object} utils.Response{data=map[string]interface{}} "Price retrieved successfully"
// @Failure 400 {object} utils.Response "Invalid currency ID"
// @Failure 404 {object} utils.Response "Currency not found or CoinGecko ID not configured"
// @Failure 500 {object} utils.Response "Failed to fetch price"
// @Router /currencies/{currency_id}/price [get]
// GetWithdrawalFees returns the withdrawal fee schedule for fiat and crypto.
// @Summary Get withdrawal fee schedule
// @Description Public: returns the fee tiers for fiat withdrawals and per-network fees for crypto withdrawals.
// @Tags reference
// @Produce json
// @Success 200 {object} utils.Response
// @Router /withdrawal-fees [get]
func (h *ReferenceHandler) GetWithdrawalFees(c *gin.Context) {
	fees := map[string]interface{}{
		"fiat": map[string]interface{}{
			"currency": "NGN",
			"tiers": []map[string]interface{}{
				{
					"min_amount":  0,
					"max_amount":  9999.99,
					"fee":         30,
					"stamp_duty":  0,
					"total_fee":   30,
					"description": "Transfer charges",
				},
				{
					"min_amount":  10000,
					"max_amount":  nil,
					"fee":         30,
					"stamp_duty":  50,
					"total_fee":   80,
					"description": "Transfer charges + Stamp duty",
				},
			},
		},
		"crypto": map[string]interface{}{
			"networks": []map[string]interface{}{
				{
					"network":    "trc20",
					"fee":        1,
					"currencies": []string{"USDT", "USDC"},
				},
				{
					"network":    "erc20",
					"fee":        5,
					"currencies": []string{"USDT", "USDC"},
				},
			},
		},
	}

	utils.SuccessResponse(c, http.StatusOK, "Withdrawal fees retrieved", fees)
}

// GetCryptoWithdrawalFee returns the live withdrawal fee for a currency on a specific network.
// @Summary Get crypto withdrawal fee
// @Description Public: returns the withdrawal fee for a specific currency and chain, sourced from Quidax and cached for 5 hours.
// @Tags reference
// @Accept json
// @Produce json
// @Param currency query string true "Currency symbol (e.g. usdt)"
// @Param chain query string true "Network chain key (e.g. erc20, trc20)"
// @Success 200 {object} utils.Response "Withdrawal fee retrieved"
// @Failure 400 {object} utils.Response "Missing or invalid parameters"
// @Failure 500 {object} utils.Response "Failed to fetch fee"
// @Router /withdrawal-fees/crypto [get]
func (h *ReferenceHandler) GetCryptoWithdrawalFee(c *gin.Context) {
	currency := c.Query("currency")
	chain := service.NormaliseQuidaxNetwork(currency, c.Query("chain"))

	if currency == "" || chain == "" {
		utils.ValidationErrorResponse(c, "currency and chain query parameters are required")
		return
	}

	// Validate that the currency and chain exist and are linked in currency_networks.
	cur, err := h.currencyRepo.FindBySymbol(currency)
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "Unsupported currency", nil)
		return
	}

	net, err := h.networkRepo.FindActiveByChainKeyNetworkType(chain, "mainnet")
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "Unsupported or inactive chain", nil)
		return
	}

	supported, err := h.networkRepo.CurrencyExistsOnNetwork(cur.ID, net.ID)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}
	if !supported {
		utils.ErrorResponse(c, http.StatusBadRequest, "Currency is not supported on the specified chain", nil)
		return
	}

	info, err := h.feeService.GetCryptoWithdrawalFeeInfo(c.Request.Context(), currency, chain)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Withdrawal fee retrieved", info)
}

func (h *ReferenceHandler) GetCurrencyPrice(c *gin.Context) {
	currencyIDStr := c.Param("currency_id")
	currencyID, err := uuid.Parse(currencyIDStr)
	if err != nil {
		utils.ValidationErrorResponse(c, "Invalid currency ID")
		return
	}

	price, err := h.priceService.GetCurrencyPriceInNGN(c.Request.Context(), currencyID)
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	response := map[string]interface{}{
		"currency_id": currencyID,
		"price":       price.String(),
		"currency":    "NGN",
	}

	utils.SuccessResponse(c, http.StatusOK, "Price retrieved successfully", response)
}
