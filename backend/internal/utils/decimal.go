package utils

import (
	"strings"

	"github.com/shopspring/decimal"
)

// fiatCurrencies is the set of known fiat currency symbols.
var fiatCurrencies = map[string]bool{
	"NGN": true,
	"USD": true,
	"EUR": true,
	"GBP": true,
}

// IsFiatCurrency reports whether the given currency symbol is a fiat currency.
func IsFiatCurrency(symbol string) bool {
	return fiatCurrencies[strings.ToUpper(symbol)]
}

// TruncateIfFiat returns amount truncated to 2 decimal places when currency is
// a fiat currency, otherwise returns amount unchanged.
func TruncateIfFiat(amount decimal.Decimal, currency string) decimal.Decimal {
	if IsFiatCurrency(currency) {
		return amount.Truncate(2)
	}
	return amount
}
