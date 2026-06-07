package coingecko

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/ratelimit"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
)

type Client struct {
	cfg        config.CoinGeckoConfig
	httpClient *http.Client
}

func NewClient(cfg config.CoinGeckoConfig) *Client {
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout:   10 * time.Second,
			Transport: ratelimit.NewTransport(ratelimit.NewLimiter(10.0/60, 3)), // 10 req/min, burst 3
		},
	}
}

// SimplePriceResponse represents the response from CoinGecko's simple/price endpoint.
// Example: {"tether":{"ngn":1351.39}}
type SimplePriceResponse map[string]map[string]float64

// GetPrice fetches the current price of a cryptocurrency in the specified fiat currency.
// coinID: CoinGecko coin ID (e.g., "tether", "ethereum")
// vsCurrency: Fiat currency code (e.g., "ngn", "usd")
func (c *Client) GetPrice(ctx context.Context, coinID, vsCurrency string) (decimal.Decimal, error) {
	if strings.TrimSpace(coinID) == "" {
		return decimal.Zero, errors.New("coinID is required")
	}
	if strings.TrimSpace(vsCurrency) == "" {
		return decimal.Zero, errors.New("vsCurrency is required")
	}

	base := strings.TrimRight(c.cfg.BaseURL, "/")
	if base == "" {
		return decimal.Zero, errors.New("COINGECKO_BASE_URL is required")
	}

	// Build URL with properly encoded query parameters to prevent parameter pollution.
	params := url.Values{}
	params.Set("ids", strings.ToLower(strings.TrimSpace(coinID)))
	params.Set("vs_currencies", strings.ToLower(strings.TrimSpace(vsCurrency)))
	reqURL := base + "/simple/price?" + params.Encode()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return decimal.Zero, err
	}

	// Add API key header if provided
	if strings.TrimSpace(c.cfg.APIKey) != "" {
		httpReq.Header.Set("x-cg-demo-api-key", c.cfg.APIKey)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return decimal.Zero, fmt.Errorf("coingecko request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return decimal.Zero, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		logger.FromCtx(ctx).Error("CoinGecko API error",
			zap.Int("status", resp.StatusCode),
			zap.String("coin", coinID),
			zap.String("vs_currency", vsCurrency),
		)
		return decimal.Zero, fmt.Errorf("coingecko error: status=%d body=%s", resp.StatusCode, string(body))
	}

	var priceResp SimplePriceResponse
	if err := json.Unmarshal(body, &priceResp); err != nil {
		return decimal.Zero, fmt.Errorf("failed to parse coingecko response: %w", err)
	}

	// Extract the price
	coinData, ok := priceResp[strings.ToLower(coinID)]
	if !ok {
		return decimal.Zero, fmt.Errorf("coin %q not found in response", coinID)
	}

	price, ok := coinData[strings.ToLower(vsCurrency)]
	if !ok {
		return decimal.Zero, fmt.Errorf("currency %q not found for coin %q", vsCurrency, coinID)
	}

	result := decimal.NewFromFloat(price)
	logger.FromCtx(ctx).Info("CoinGecko GetPrice success",
		zap.String("coin", coinID),
		zap.String("vs_currency", vsCurrency),
		zap.String("price", result.String()),
	)
	return result, nil
}

// HealthCheck verifies connectivity to the CoinGecko API (placeholder).
func (c *Client) HealthCheck() error {
	return nil
}
