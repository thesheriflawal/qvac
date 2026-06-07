package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/shopspring/decimal"
)

// CryptoWithdrawalFee is the fee payload.
type CryptoWithdrawalFee struct {
	Fee      float64 `json:"fee"`
	Type     string  `json:"type"` // "flat" or "percent"
	Currency string  `json:"currency"`
	Network  string  `json:"network"`
}

// FeeService provides withdrawal fee lookups.
type FeeService interface {
	GetCryptoWithdrawalFee(ctx context.Context, currency, network string, amount decimal.Decimal) (decimal.Decimal, error)
	GetCryptoWithdrawalFeeInfo(ctx context.Context, currency, network string) (*CryptoWithdrawalFee, error)
}

type feeService struct{}

// NewFeeService creates a FeeService backed by a static fee table.
func NewFeeService() FeeService {
	return &feeService{}
}

// fallbackFees is the static fee table.
var fallbackFees = map[string]CryptoWithdrawalFee{
	"usdc:arbitrum":    {Fee: 1.0, Type: "flat"},
	"usdc:base":        {Fee: 1.0, Type: "flat"},
	"usdc:bep20":       {Fee: 1.0, Type: "flat"},
	"usdc:erc20":       {Fee: 1.0, Type: "flat"},
	"usdc:lisk":        {Fee: 0.5, Type: "flat"},
	"usdc:polygon":     {Fee: 1.0, Type: "flat"},
	"usdc:sol":         {Fee: 1.0, Type: "flat"},
	"usdc:trc20":       {Fee: 1.0, Type: "flat"},
	"usdt:arbitrum":    {Fee: 1.0, Type: "flat"},
	"usdt:bep20":       {Fee: 0.5, Type: "flat"},
	"usdt:celo":        {Fee: 0.5, Type: "flat"},
	"usdt:erc20":       {Fee: 5.0, Type: "flat"},
	"usdt:lisk":        {Fee: 0.5, Type: "flat"},
	"usdt:optimism":    {Fee: 0.5, Type: "flat"},
	"usdt:polygon":     {Fee: 1.0, Type: "flat"},
	"usdt:solana":      {Fee: 1.0, Type: "flat"},
	"usdt:ton network": {Fee: 0.5, Type: "flat"},
	"usdt:trc20":       {Fee: 1.0, Type: "flat"},
}

// NormaliseQuidaxNetwork maps internal chain keys to normalised identifiers.
func NormaliseQuidaxNetwork(currency, network string) string {
	if strings.EqualFold(currency, "usdt") && strings.EqualFold(network, "sol") {
		return "solana"
	}
	return network
}

func (s *feeService) GetCryptoWithdrawalFee(ctx context.Context, currency, network string, amount decimal.Decimal) (decimal.Decimal, error) {
	info, err := s.GetCryptoWithdrawalFeeInfo(ctx, currency, network)
	if err != nil {
		return decimal.Zero, err
	}
	value := decimal.NewFromFloat(info.Fee)
	if info.Type == "percent" {
		return amount.Mul(value).Div(decimal.NewFromInt(100)), nil
	}
	return value, nil
}

func (s *feeService) GetCryptoWithdrawalFeeInfo(_ context.Context, currency, network string) (*CryptoWithdrawalFee, error) {
	currency = strings.ToLower(strings.TrimSpace(currency))
	network = strings.ToLower(strings.TrimSpace(network))
	network = NormaliseQuidaxNetwork(currency, network)

	if currency == "" {
		return nil, fmt.Errorf("currency is required")
	}
	if network == "" {
		return nil, fmt.Errorf("network is required")
	}

	key := fmt.Sprintf("%s:%s", currency, network)
	if fb, ok := fallbackFees[key]; ok {
		fb.Currency = currency
		fb.Network = network
		return &fb, nil
	}
	return nil, fmt.Errorf("no fee data for %s on %s", currency, network)
}
