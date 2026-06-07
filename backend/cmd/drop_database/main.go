package main

import (
	"fmt"
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DANGER: This deletes ALL data from the configured database.
//
// It truncates every table in the "public" schema with RESTART IDENTITY + CASCADE.
//
// Usage:
//
//	go run ./cmd/drop_database
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

	dsn := cfg.GetDSN()
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}

	logger.Warn("About to delete all data from database", zap.String("db", cfg.Database.Name))

	// Build and execute one TRUNCATE statement over all tables in public schema.
	// This avoids ordering issues with foreign keys.
	var tables []string
	if err := db.Raw(
		`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`,
	).Scan(&tables).Error; err != nil {
		logger.Fatal("Failed to list tables", zap.Error(err))
	}

	if len(tables) == 0 {
		logger.Info("No tables found in public schema; nothing to truncate")
		return
	}

	quoted := make([]string, 0, len(tables))
	for _, t := range tables {
		quoted = append(quoted, fmt.Sprintf("\"public\".\"%s\"", strings.ReplaceAll(t, "\"", "\"\"")))
	}

	truncateSQL := fmt.Sprintf("TRUNCATE TABLE %s RESTART IDENTITY CASCADE", strings.Join(quoted, ", "))
	if err := db.Exec(truncateSQL).Error; err != nil {
		logger.Fatal("Failed to truncate tables", zap.Error(err))
	}

	logger.Info("All tables truncated successfully", zap.Int("tables", len(tables)))
}
