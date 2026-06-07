package main

// import (
// 	"bufio"
// 	"fmt"
// 	"os"
// 	"strings"

// 	"github.com/Kynettic-org/kynettic-backend/internal/config"
// 	"github.com/Kynettic-org/kynettic-backend/internal/database"
// 	"github.com/Kynettic-org/kynettic-backend/internal/models"
// 	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
// )

// func main() {
// 	cfg, err := config.Load()
// 	if err != nil {
// 		fmt.Printf("Failed to load config: %v\n", err)
// 		return
// 	}

// 	if err := logger.Initialize("info", "console"); err != nil {
// 		fmt.Printf("Failed to initialize logger: %v\n", err)
// 		return
// 	}

// 	if err := database.Initialize(cfg); err != nil {
// 		fmt.Printf("Failed to connect to database: %v\n", err)
// 		return
// 	}
// 	defer database.Close()

// 	// Count users first.
// 	var count int64
// 	if err := database.DB.Model(&models.User{}).Count(&count).Error; err != nil {
// 		fmt.Printf("Failed to count users: %v\n", err)
// 		return
// 	}

// 	if count == 0 {
// 		fmt.Println("No users found in the database.")
// 		return
// 	}

// 	fmt.Printf("⚠️  Found %d user(s) in the database.\n", count)
// 	fmt.Print("Are you sure you want to delete ALL users and their related data? (yes/no): ")

// 	reader := bufio.NewReader(os.Stdin)
// 	answer, _ := reader.ReadString('\n')
// 	answer = strings.TrimSpace(strings.ToLower(answer))

// 	if answer != "yes" {
// 		fmt.Println("Aborted.")
// 		return
// 	}

// 	// Delete in dependency order to avoid FK violations.
// 	// GORM soft-deletes if the model has DeletedAt; use Unscoped() for hard delete.
// 	tables := []struct {
// 		name  string
// 		model interface{}
// 	}{
// 		{"notifications", &models.Notification{}},
// 		{"notification_settings", &models.NotificationSetting{}},
// 		{"internal_transfers", &models.InternalTransfer{}},
// 		{"fiat_withdrawals", &models.FiatWithdrawal{}},
// 		{"fiat_deposits", &models.FiatDeposit{}},
// 		{"crypto_withdrawals", &models.CryptoWithdrawal{}},
// 		{"crypto_deposits", &models.CryptoDeposit{}},
// 		{"crypto_addresses", &models.CryptoAddress{}},
// 		{"wallet_transactions", &models.WalletTransaction{}},
// 		{"wallets", &models.Wallet{}},
// 		{"p2p_orders", &models.P2POrder{}},
// 		{"p2p_ads", &models.P2PAd{}},
// 		{"bank_accounts", &models.BankAccount{}},
// 		{"kyc_verifications", &models.KYCVerification{}},
// 		{"user_securities", &models.UserSecurity{}},
// 		{"user_profiles", &models.UserProfile{}},
// 		{"users", &models.User{}},
// 	}

// 	for _, t := range tables {
// 		res := database.DB.Unscoped().Where("1 = 1").Delete(t.model)
// 		if res.Error != nil {
// 			fmt.Printf("✗ Failed to delete %s: %v\n", t.name, res.Error)
// 			return
// 		}
// 		fmt.Printf("✓ Deleted %d row(s) from %s\n", res.RowsAffected, t.name)
// 	}

// 	fmt.Println("\n✅ All users and related data have been deleted.")
// }
