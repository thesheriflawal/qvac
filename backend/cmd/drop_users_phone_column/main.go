package main

import (
	"fmt"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"go.uber.org/zap"
)

// One-off migration helper.
//
// GORM AutoMigrate does NOT drop columns; this command explicitly drops the legacy `users.phone` column.
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

	logger.Info("Dropping users.phone column (if exists)")
	if err := database.GetDB().Exec("ALTER TABLE users DROP COLUMN IF EXISTS phone").Error; err != nil {
		logger.Fatal("Failed to drop users.phone", zap.Error(err))
	}

	logger.Info("Done")
}
