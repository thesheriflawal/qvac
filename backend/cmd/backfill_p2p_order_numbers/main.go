package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Reuse the main application's config loader so .env and environment
	// variables are handled consistently.
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	dsn := cfg.GetDSN()

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		NowFunc: func() time.Time { return time.Now().UTC() },
	})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	ctx := context.Background()
	if err := backfillOrderNumbers(ctx, db, 500); err != nil {
		log.Fatalf("backfill failed: %v", err)
	}

	log.Println("backfill completed successfully")
}

func backfillOrderNumbers(ctx context.Context, db *gorm.DB, batchSize int) error {
	for {
		var orders []models.P2POrder

		// Fetch a batch of orders missing order_number
		if err := db.WithContext(ctx).
			Where("order_number = '' OR order_number IS NULL").
			Limit(batchSize).
			Find(&orders).Error; err != nil {
			return fmt.Errorf("query orders: %w", err)
		}

		if len(orders) == 0 {
			log.Println("no more orders to update")
			return nil
		}

		log.Printf("processing batch of %d orders\n", len(orders))

		for _, o := range orders {
			uid, err := utils.Generate20DigitUID()
			if err != nil {
				return fmt.Errorf("generate uid for order %d: %w", o.ID, err)
			}

			// Update one-by-one with a safety WHERE to avoid overwriting non-empty values
			if err := db.WithContext(ctx).
				Model(&models.P2POrder{}).
				Where("id = ? AND (order_number = '' OR order_number IS NULL)", o.ID).
				Update("order_number", uid).Error; err != nil {
				return fmt.Errorf("update order %d: %w", o.ID, err)
			}
		}
	}
}
