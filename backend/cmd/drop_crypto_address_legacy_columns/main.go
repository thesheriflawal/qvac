package main

import (
	"fmt"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"go.uber.org/zap"
)

// DANGER: This drops legacy columns from crypto_addresses.
//
// Use only after you've migrated to network_id/currency_id and verified data.
//
// Usage:
//
//	go run ./cmd/drop_crypto_address_legacy_columns
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
	// Old schema used `currency` and `network` as string columns.
	if err := db.Exec("ALTER TABLE crypto_addresses DROP COLUMN IF EXISTS currency").Error; err != nil {
		logger.Fatal("Failed to drop crypto_addresses.currency", zap.Error(err))
	}
	if err := db.Exec("ALTER TABLE crypto_addresses DROP COLUMN IF EXISTS network").Error; err != nil {
		logger.Fatal("Failed to drop crypto_addresses.network", zap.Error(err))
	}

	logger.Info("Dropped legacy columns from crypto_addresses")
}
