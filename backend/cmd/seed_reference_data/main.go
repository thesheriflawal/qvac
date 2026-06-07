package main

import (
	"fmt"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"go.uber.org/zap"
)

// Seeds baseline reference data needed for development.
//
// Usage:
//
//	go run ./cmd/seed_reference_data
func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Failed to load configuration: %v\n", err)
		return
	}

	if err := logger.Initialize(cfg.Log.Level, cfg.Log.Format); err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		return
	}
	defer logger.Sync()

	if err := database.Initialize(cfg); err != nil {
		logger.Fatal("Failed to initialize database", zap.Error(err))
	}
	defer database.Close()

	db := database.GetDB()

	// BSC testnet
	// Chain id: 97
	network := models.Network{
		Name:        "BSc",
		ChainKey:    "bsc",
		NetworkType: "testnet",
		ChainID:     97,
		IsActive:    true,
	}

	// Upsert by unique index (chain_key, network_type)
	if err := db.Where("chain_key = ? AND network_type = ?", network.ChainKey, network.NetworkType).
		Assign(network).
		FirstOrCreate(&network).Error; err != nil {
		logger.Fatal("Failed to seed network", zap.Error(err))
	}

	// USDT
	currency := models.Currency{
		Symbol:   "USDT",
		Name:     "Tether",
		Decimals: 6,
		IsNative: false,
	}

	if err := db.Where("symbol = ?", currency.Symbol).
		Assign(currency).
		FirstOrCreate(&currency).Error; err != nil {
		logger.Fatal("Failed to seed currency", zap.Error(err))
	}

	logger.Info("Seeded reference data",
		zap.String("network_id", network.ID.String()),
		zap.String("network", network.ChainKey+":"+network.NetworkType),
		zap.String("currency_id", currency.ID.String()),
		zap.String("currency", currency.Symbol),
	)
}
