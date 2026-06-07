package database

import (
	"fmt"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

var DB *gorm.DB

// Initialize connects to the database and runs migrations
func Initialize(cfg *config.Config) error {
	dsn := cfg.GetDSN()

	// Configure GORM logger
	var gormLogLevel gormlogger.LogLevel
	if cfg.IsDevelopment() {
		gormLogLevel = gormlogger.Info
	} else {
		gormLogLevel = gormlogger.Error
	}

	gormConfig := &gorm.Config{
		Logger: gormlogger.Default.LogMode(gormLogLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	// Connect to database
	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Get underlying SQL database
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	// Configure connection pool
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	DB = db

	logger.Info("Database connected successfully")

	// Run auto-migrations
	if cfg.Database.AutoMigrate {
		if err := AutoMigrate(); err != nil {
			return fmt.Errorf("failed to run migrations: %w", err)
		}
	} else {
		logger.Info("Skipping database migrations (DB_AUTO_MIGRATE=false)")
	}

	return nil
}

// AutoMigrate runs database migrations for all models
func AutoMigrate() error {
	logger.Info("Running database migrations...")

	err := DB.AutoMigrate(
		&models.Network{},
		&models.Currency{},
		&models.User{},
		&models.UserProfile{},
		&models.UserSecurity{},
		&models.Wallet{},
		&models.WalletTransaction{},
		&models.P2PAd{},
		&models.P2POrder{},
		&models.P2PTradeFee{},
		&models.PlatformFeeBalance{},
		&models.CryptoDeposit{},
		&models.CryptoWithdrawal{},
		&models.CryptoAddress{},
		&models.FiatDeposit{},
		&models.FiatWithdrawal{},
		&models.BankAccount{},
		&models.InternalTransfer{},
		&models.Notification{},
		&models.NotificationSetting{},
		&models.KYCVerification{},
		&models.Referral{},
		&models.ReferralPointBalance{},
		&models.ReferralPointTransaction{},
		&models.ReferralConfig{},
		&models.ReferralClaimCycle{},
		&models.ReferralClaim{},
		&models.CurrencyNetwork{},
		&models.Review{},
		&models.WithdrawalLimitOverride{},
		&models.CommunityLink{},
		// AI agent tables
		&models.Agent{},
		&models.AgentDecision{},
		// Anomaly detection
		&models.AnomalyScore{},
	)

	if err != nil {
		return err
	}

	// Drop the old single-column unique index on p2p_trade_fees.order_id that
	// was replaced by the composite (order_id, role) index. GORM AutoMigrate
	// never removes indexes, so we do it explicitly. IF EXISTS makes this a no-op
	// once the index is gone.
	if err := DB.Exec("DROP INDEX IF EXISTS idx_p2p_trade_fees_order_id").Error; err != nil {
		return fmt.Errorf("failed to drop old p2p_trade_fees index: %w", err)
	}

	// Drop max_amount from p2p_ads since the model field was removed.
	// AutoMigrate does not drop columns automatically.
	if err := DB.Exec("ALTER TABLE p2p_ads DROP COLUMN IF EXISTS max_amount").Error; err != nil {
		return fmt.Errorf("failed to drop max_amount column: %w", err)
	}

	// Backfill referral codes for existing users that were created
	// before the referral_code column was added.
	if err := backfillReferralCodes(); err != nil {
		return fmt.Errorf("failed to backfill referral codes: %w", err)
	}

	// Seed default referral config values if they don't exist.
	seedReferralConfigs()

	// Seed stablecoin network mappings.
	seedCurrencyNetworks()

	logger.Info("Database migrations completed successfully")
	return nil
}

// backfillReferralCodes generates unique referral codes for any users that
// don't have one (pre-existing rows before the column was introduced), then
// applies the NOT NULL constraint.
func backfillReferralCodes() error {
	var users []models.User
	if err := DB.Where("referral_code IS NULL OR referral_code = ''").Find(&users).Error; err != nil {
		return err
	}

	if len(users) == 0 {
		// Ensure NOT NULL constraint is present even when there's nothing to backfill.
		DB.Exec("ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL")
		return nil
	}

	logger.Info("Backfilling referral codes for existing users",
		zap.Int("count", len(users)),
	)

	for i := range users {
		code, err := utils.GenerateReferralCode()
		if err != nil {
			return fmt.Errorf("failed to generate referral code: %w", err)
		}
		if err := DB.Model(&users[i]).Update("referral_code", code).Error; err != nil {
			return fmt.Errorf("failed to update user %s: %w", users[i].ID, err)
		}
	}

	// Now that every row has a value, enforce NOT NULL.
	if err := DB.Exec("ALTER TABLE users ALTER COLUMN referral_code SET NOT NULL").Error; err != nil {
		return fmt.Errorf("failed to set NOT NULL on referral_code: %w", err)
	}

	logger.Info("Referral code backfill completed")
	return nil
}

// seedReferralConfigs inserts default referral configuration values
// if they are not already present in the database.
func seedReferralConfigs() {
	defaults := []models.ReferralConfig{
		{Key: models.ReferralConfigPointsPerUSD, Value: "1.0", Description: "Points earned per USD of referee P2P trade volume"},
		{Key: models.ReferralConfigMinTradesEligibility, Value: "3", Description: "Minimum completed P2P trades per quarter for referrer eligibility"},
	}

	for _, cfg := range defaults {
		var existing models.ReferralConfig
		if err := DB.Where("key = ?", cfg.Key).First(&existing).Error; err != nil {
			if err := DB.Create(&cfg).Error; err != nil {
				logger.Warn("Failed to seed referral config",
					zap.String("key", cfg.Key),
					zap.Error(err),
				)
			}
		}
	}
}

// seedCurrencyNetworks ensures the supported networks for USDT and USDC are
// present in the database. It upserts the networks and currencies first, then
// creates CurrencyNetwork rows that don't already exist.
func seedCurrencyNetworks() {
	type networkDef struct {
		Name        string
		ChainKey    string
		NetworkType string
		ChainID     int64
	}

	networks := []networkDef{
		{"Ethereum (ERC20)", "erc20", "mainnet", 1},
		{"BNB Smart Chain (BEP20)", "bep20", "mainnet", 56},
		{"Tron (TRC20)", "trc20", "mainnet", 0},
		{"Polygon", "polygon", "mainnet", 137},
		{"Arbitrum", "arbitrum", "mainnet", 42161},
		{"Optimism", "optimism", "mainnet", 10},
		{"Solana", "solana", "mainnet", 0},
		{"Celo", "celo", "mainnet", 42220},
		{"TON Network", "ton", "mainnet", 0},
		{"Lisk", "lisk", "mainnet", 1135},
		{"Base", "base", "mainnet", 8453},
	}

	// Upsert networks.
	networkMap := make(map[string]models.Network) // chain_key -> Network
	for _, nd := range networks {
		var n models.Network
		if err := DB.Where("chain_key = ? AND network_type = ?", nd.ChainKey, nd.NetworkType).
			Assign(models.Network{
				Name:     nd.Name,
				ChainKey: nd.ChainKey, NetworkType: nd.NetworkType,
				ChainID: nd.ChainID, IsActive: true,
			}).FirstOrCreate(&n).Error; err != nil {
			logger.Warn("Failed to seed network",
				zap.String("chain_key", nd.ChainKey),
				zap.Error(err),
			)
			continue
		}
		networkMap[nd.ChainKey] = n
	}

	// Upsert USDT and USDC currencies.
	stablecoins := []models.Currency{
		{Symbol: "USDT", Name: "Tether", Decimals: 6, CoinGeckoID: "tether"},
		{Symbol: "USDC", Name: "USD Coin", Decimals: 6, CoinGeckoID: "usd-coin"},
	}

	currencyMap := make(map[string]models.Currency)
	for _, cur := range stablecoins {
		var c models.Currency
		if err := DB.Where("symbol = ?", cur.Symbol).
			Assign(cur).
			FirstOrCreate(&c).Error; err != nil {
			logger.Warn("Failed to seed currency",
				zap.String("symbol", cur.Symbol),
				zap.Error(err),
			)
			continue
		}
		currencyMap[cur.Symbol] = c
	}

	// Define which networks each stablecoin supports.
	mappings := map[string][]string{
		"USDT": {"celo", "polygon", "bep20", "trc20", "arbitrum", "solana", "ton", "optimism", "erc20", "lisk"},
		"USDC": {"polygon", "solana", "arbitrum", "lisk", "bep20", "erc20", "trc20", "base"},
	}

	for symbol, chainKeys := range mappings {
		cur, ok := currencyMap[symbol]
		if !ok {
			continue
		}
		for _, ck := range chainKeys {
			net, ok := networkMap[ck]
			if !ok {
				continue
			}
			var existing models.CurrencyNetwork
			if err := DB.Where("currency_id = ? AND network_id = ?", cur.ID, net.ID).
				FirstOrCreate(&existing, models.CurrencyNetwork{
					CurrencyID: cur.ID,
					NetworkID:  net.ID,
				}).Error; err != nil {
				logger.Warn("Failed to seed currency-network mapping",
					zap.String("currency", symbol),
					zap.String("network", ck),
					zap.Error(err),
				)
			}
		}
	}

	logger.Info("Currency-network seed completed")
}

// Close closes the database connection
func Close() error {
	if DB != nil {
		sqlDB, err := DB.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}

// HealthCheck checks if the database is accessible
func HealthCheck() error {
	if DB == nil {
		return fmt.Errorf("database not initialized")
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}

	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	return nil
}

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return DB
}

// Transaction executes a function within a database transaction
func Transaction(fn func(*gorm.DB) error) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return fn(tx)
	})
}

// WithContext returns a new database instance with context
func WithContext(db *gorm.DB) *gorm.DB {
	return db.Session(&gorm.Session{})
}

// Paginate is a helper function for pagination
func Paginate(page, pageSize int) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if page <= 0 {
			page = 1
		}

		if pageSize <= 0 || pageSize > 100 {
			pageSize = 10
		}

		offset := (page - 1) * pageSize
		return db.Offset(offset).Limit(pageSize)
	}
}

// LogQuery logs the SQL query (for debugging)
func LogQuery(db *gorm.DB) {
	sql := db.ToSQL(func(tx *gorm.DB) *gorm.DB {
		return tx
	})
	logger.Debug("SQL Query", zap.String("sql", sql))
}
