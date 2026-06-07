package utils

import (
	"sync"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// decimalsCache caches currency Decimals values looked up from the DB to
// avoid a round-trip on every balance update.
var decimalsCache sync.Map // map[string]int

// CurrencyDecimalsFromDB returns the Decimals field for the given currency
// symbol. Results are cached for the lifetime of the process.
func CurrencyDecimalsFromDB(db *gorm.DB, symbol string) (int, error) {
	if v, ok := decimalsCache.Load(symbol); ok {
		return v.(int), nil
	}

	var result struct{ Decimals int }
	if err := db.Table("currencies").Select("decimals").Where("symbol = ?", symbol).Scan(&result).Error; err != nil {
		return 0, err
	}

	decimalsCache.Store(symbol, result.Decimals)
	return result.Decimals, nil
}

// unitFactor returns 10^decimals as a decimal.Decimal.
func unitFactor(decimals int) decimal.Decimal {
	return decimal.New(1, int32(decimals))
}

// ToStorageUnits converts a human-readable decimal amount to its smallest-unit
// integer representation, truncating toward zero to the unit boundary.
// Example: 150.009 NGN (decimals=2) → 15000.
func ToStorageUnits(amount decimal.Decimal, decimals int) int64 {
	return amount.Mul(unitFactor(decimals)).Truncate(0).IntPart()
}

// FeeToStorageUnits converts a fee to its smallest-unit integer representation,
// ceiling to the next unit so the platform always receives at least the computed
// fee and fractional units are never lost.
// Example: 1.501 NGN (decimals=2) → 151 (kobo).
func FeeToStorageUnits(fee decimal.Decimal, decimals int) int64 {
	return fee.Mul(unitFactor(decimals)).Ceil().IntPart()
}

// FromStorageUnits converts smallest-unit integer storage back to a
// human-readable decimal.
// Example: 15000 kobo (decimals=2) → 150.00 NGN.
func FromStorageUnits(units int64, decimals int) decimal.Decimal {
	return decimal.NewFromInt(units).Div(unitFactor(decimals))
}
