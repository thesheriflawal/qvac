package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/clients/coingecko"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	// priceCacheTTL controls how often we hit CoinGecko (fetch throttle)
	priceCacheTTL = 60 * time.Second
	// emaCacheTTL keeps the EMA state alive between fetch cycles
	emaCacheTTL = 20 * time.Minute
	// emaAlpha is the EMA smoothing factor (0.25 ≈ 4-sample equivalent window)
	emaAlpha            = 0.25
	priceCacheKeyPrefix = "price:"
	emaCacheKeyPrefix   = "price:ema:"
)

// PriceService handles cryptocurrency price fetching and caching.
type PriceService interface {
	// GetMarketPrice fetches the current market price for a cryptocurrency.
	// It uses Redis caching to minimize API calls to CoinGecko.
	GetMarketPrice(ctx context.Context, coinGeckoID, vsCurrency string) (decimal.Decimal, error)

	// CalculateEffectivePrice calculates the effective price for a P2P ad.
	// For fixed pricing, it returns ad.Price directly.
	// For relative pricing, it fetches the market price and applies the relative_percent.
	CalculateEffectivePrice(ctx context.Context, ad *models.P2PAd, currency *models.Currency) (decimal.Decimal, error)

	// GetCurrencyPriceInNGN fetches the current price of a currency in NGN by currency ID.
	GetCurrencyPriceInNGN(ctx context.Context, currencyID uuid.UUID) (decimal.Decimal, error)
}

type priceService struct {
	coinGeckoClient *coingecko.Client
	currencyRepo    repository.CurrencyRepository
}

// NewPriceService creates a new PriceService.
func NewPriceService(coinGeckoClient *coingecko.Client, currencyRepo repository.CurrencyRepository) PriceService {
	return &priceService{
		coinGeckoClient: coinGeckoClient,
		currencyRepo:    currencyRepo,
	}
}

// GetMarketPrice fetches the current market price with EMA smoothing.
//
// Two Redis keys per coin:
//   - price:<coin>:<currency>      60s throttle — expires to trigger a CoinGecko refresh
//   - price:ema:<coin>:<currency>  20m EMA state — survives between refreshes
//
// On each refresh the new EMA is computed as: α*spot + (1-α)*prevEMA.
// If CoinGecko is unreachable but a prior EMA exists, the stale EMA is returned
// instead of an error, keeping relative-price ads alive during brief API outages.
func (s *priceService) GetMarketPrice(ctx context.Context, coinGeckoID, vsCurrency string) (decimal.Decimal, error) {
	coinGeckoID = strings.ToLower(strings.TrimSpace(coinGeckoID))
	vsCurrency = strings.ToLower(strings.TrimSpace(vsCurrency))

	if coinGeckoID == "" {
		return decimal.Zero, fmt.Errorf("coinGeckoID is required")
	}
	if vsCurrency == "" {
		return decimal.Zero, fmt.Errorf("vsCurrency is required")
	}

	throttleKey := fmt.Sprintf("%s%s:%s", priceCacheKeyPrefix, coinGeckoID, vsCurrency)
	emaKey := fmt.Sprintf("%s%s:%s", emaCacheKeyPrefix, coinGeckoID, vsCurrency)

	if cache.Client != nil {
		var prevEMA decimal.Decimal
		hasEMA := cache.Client.GetJSON(emaKey, &prevEMA) == nil

		// If the throttle key is still alive, no need to hit CoinGecko
		var throttleVal decimal.Decimal
		if hasEMA && cache.Client.GetJSON(throttleKey, &throttleVal) == nil {
			logger.Debug("Price EMA cache hit",
				zap.String("coin", coinGeckoID),
				zap.String("vs", vsCurrency),
				zap.String("ema", prevEMA.String()),
			)
			return prevEMA, nil
		}

		// Throttle expired — fetch a fresh spot price
		logger.Debug("Price cache miss, fetching from CoinGecko",
			zap.String("coin", coinGeckoID),
			zap.String("vs", vsCurrency),
		)
		spot, err := s.coinGeckoClient.GetPrice(ctx, coinGeckoID, vsCurrency)
		if err != nil {
			logger.Error("CoinGecko price fetch failed",
				zap.String("coin", coinGeckoID),
				zap.String("vs", vsCurrency),
				zap.Error(err),
			)
			if hasEMA {
				logger.Warn("Returning stale EMA due to CoinGecko error",
					zap.String("coin", coinGeckoID),
					zap.String("ema", prevEMA.String()),
				)
				return prevEMA, nil
			}
			return decimal.Zero, fmt.Errorf("failed to fetch price from CoinGecko: %w", err)
		}

		// Compute EMA; initialise with spot on first fetch
		newEMA := spot
		if hasEMA {
			alpha := decimal.NewFromFloat(emaAlpha)
			oneMinusAlpha := decimal.NewFromFloat(1 - emaAlpha)
			newEMA = alpha.Mul(spot).Add(oneMinusAlpha.Mul(prevEMA))
		}

		_ = cache.Client.SetJSON(emaKey, newEMA, emaCacheTTL)
		_ = cache.Client.SetJSON(throttleKey, spot, priceCacheTTL)

		logger.Debug("Price EMA updated",
			zap.String("coin", coinGeckoID),
			zap.String("spot", spot.String()),
			zap.String("ema", newEMA.String()),
		)
		return newEMA, nil
	}

	// No Redis — fetch spot directly (no smoothing)
	return s.coinGeckoClient.GetPrice(ctx, coinGeckoID, vsCurrency)
}

// CalculateEffectivePrice calculates the effective price for a P2P ad.
func (s *priceService) CalculateEffectivePrice(ctx context.Context, ad *models.P2PAd, currency *models.Currency) (decimal.Decimal, error) {
	if ad == nil {
		return decimal.Zero, fmt.Errorf("ad is required")
	}
	if currency == nil {
		return decimal.Zero, fmt.Errorf("currency is required")
	}

	priceType := strings.ToLower(strings.TrimSpace(ad.PriceType))

	switch priceType {
	case "fixed":
		// For fixed pricing, return the ad price directly
		if !ad.Price.IsPositive() {
			return decimal.Zero, fmt.Errorf("fixed price must be greater than zero")
		}
		return ad.Price, nil

	case "relative":
		// For relative pricing, fetch market price and apply the percentage
		if strings.TrimSpace(currency.CoinGeckoID) == "" {
			return decimal.Zero, fmt.Errorf("currency %s does not have a CoinGecko ID configured", currency.Symbol)
		}

		// Fetch current market price in NGN
		marketPrice, err := s.GetMarketPrice(ctx, currency.CoinGeckoID, "ngn")
		if err != nil {
			return decimal.Zero, fmt.Errorf("failed to get market price: %w", err)
		}

		if !marketPrice.IsPositive() {
			return decimal.Zero, fmt.Errorf("invalid market price: %s", marketPrice.String())
		}

		// Calculate effective price: market_price + relative_percent
		// relative_percent is a direct fiat adjustment (e.g. +50 or -20 NGN).
		// Example: market=1500.00, relative_percent=50 -> 1500.00 + 50 = 1550.00
		effectivePrice := marketPrice.Add(ad.RelativePercent)

		if !effectivePrice.IsPositive() {
			return decimal.Zero, fmt.Errorf("calculated effective price is not positive")
		}

		return effectivePrice, nil

	default:
		return decimal.Zero, fmt.Errorf("unsupported price type: %s", priceType)
	}
}

// GetCurrencyPriceInNGN fetches the current price of a currency in NGN by currency ID.
func (s *priceService) GetCurrencyPriceInNGN(ctx context.Context, currencyID uuid.UUID) (decimal.Decimal, error) {
	if currencyID == uuid.Nil {
		return decimal.Zero, fmt.Errorf("currencyID is required")
	}

	// Fetch the currency record
	currency, err := s.currencyRepo.FindByID(currencyID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return decimal.Zero, fmt.Errorf("currency not found")
		}
		return decimal.Zero, fmt.Errorf("failed to fetch currency: %w", err)
	}

	// Check if the currency has a CoinGecko ID
	if strings.TrimSpace(currency.CoinGeckoID) == "" {
		return decimal.Zero, fmt.Errorf("currency %s does not have a CoinGecko ID configured", currency.Symbol)
	}

	// Fetch the current market price in NGN
	price, err := s.GetMarketPrice(ctx, currency.CoinGeckoID, "ngn")
	if err != nil {
		return decimal.Zero, fmt.Errorf("failed to get market price: %w", err)
	}

	return price, nil
}
