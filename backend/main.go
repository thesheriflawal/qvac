package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/Kynettic-org/kynettic-backend/docs"
	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/clients/cloudinary"
	"github.com/Kynettic-org/kynettic-backend/internal/clients/coingecko"
	"github.com/Kynettic-org/kynettic-backend/internal/clients/email"
	telegramclient "github.com/Kynettic-org/kynettic-backend/internal/clients/telegram"
	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/internal/handler"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/router"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
)

// @title Kynettic API
// @version 1.0
// @description Production-ready backend API for Kynettic platform with authentication, user management, and health monitoring
// @BasePath /api/v1

// @Server http://localhost:8080/api/v1 Localhost
// @Server https://dev-api.kynettic.com/api/v1 Development Server

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Failed to load configuration: %v\n", err)
		os.Exit(1)
	}

	// Initialize logger
	if err := logger.Initialize(cfg.Log.Level, cfg.Log.Format); err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	logger.Info("Starting Kynettic API",
		zap.String("env", cfg.App.Env),
		zap.String("port", cfg.App.Port),
	)

	// Initialize validator
	utils.InitValidator()

	// Register PIN pepper so all subsequent PIN hashing and verification uses
	// the server-side secret, preventing offline brute-force of the 10^6 keyspace.
	utils.InitPINPepper(cfg.App.PINPepper)

	// Register JWT issuer and audience so tokens include and validate these
	// claims, preventing tokens issued by other services from being accepted.
	utils.InitJWT(cfg.JWT.Issuer, cfg.JWT.Audience)

	// Initialize database
	if err := database.Initialize(cfg); err != nil {
		logger.Fatal("Failed to initialize database", zap.Error(err))
	}
	defer database.Close()

	// Initialize Redis
	if err := cache.Initialize(cfg); err != nil {
		logger.Fatal("Failed to initialize Redis", zap.Error(err))
	}
	defer cache.Close()

	// Initialize external clients
	coinGeckoClient := coingecko.NewClient(cfg.CoinGecko)
	cloudinaryClient := cloudinary.NewClient(cfg.Cloudinary)

	emailSender, err := email.NewResendSender(cfg.Resend)
	if err != nil {
		logger.Fatal("Failed to initialize email sender", zap.Error(err))
	}

	logger.Info("External clients initialized",
		zap.String("coingecko_base_url", cfg.CoinGecko.BaseURL),
		zap.String("cloudinary_cloud", cfg.Cloudinary.CloudName),
		zap.String("email_provider", "resend"),
	)

	// Initialize repositories
	userRepo := repository.NewUserRepository(database.GetDB())
	cryptoAddrRepo := repository.NewCryptoAddressRepository(database.GetDB())
	networkRepo := repository.NewNetworkRepository(database.GetDB())
	currencyRepo := repository.NewCurrencyRepository(database.GetDB())
	walletRepo := repository.NewWalletRepository(database.GetDB())
	bankAccountRepo := repository.NewBankAccountRepository(database.GetDB())
	_ = bankAccountRepo // kept for future use
	p2pAdRepo := repository.NewP2PAdRepository(database.GetDB())
	notificationRepo := repository.NewNotificationRepository(database.GetDB())
	kycRepo := repository.NewKYCRepository(database.GetDB())
	referralRepo := repository.NewReferralRepository(database.GetDB())
	reviewRepo := repository.NewReviewRepository(database.GetDB())
	revenueRepo := repository.NewRevenueRepository(database.GetDB())
	communityLinkRepo := repository.NewCommunityLinkRepository(database.GetDB())

	// Initialize services
	priceService := service.NewPriceService(coinGeckoClient, currencyRepo)
	feeService := service.NewFeeService()
	referralService := service.NewReferralService(referralRepo, userRepo, priceService)
	authService := service.NewAuthService(userRepo, cfg, emailSender, referralService)
	userService := service.NewUserService(userRepo, emailSender, cfg)
	withdrawalLimitRepo := repository.NewWithdrawalLimitRepository(database.GetDB())
	withdrawalLimitService := service.NewWithdrawalLimitService(kycRepo, withdrawalLimitRepo, cache.Client)
	walletService := service.NewWalletService(userRepo, cryptoAddrRepo, networkRepo, currencyRepo, walletRepo, feeService, withdrawalLimitService, priceService, emailSender)
	kycService := service.NewKYCService(kycRepo, userRepo, cfg, database.GetDB())

	// Telegram bot + anomaly detection (must be before p2pService)
	telegramClient := telegramclient.NewClient(cfg.Telegram.BotToken)
	telegramBotService := service.NewTelegramBotService(telegramClient, cfg.Telegram.AdminChatID)
	anomalyService := service.NewAnomalyService(telegramBotService)

	// Start Telegram polling in background (no-op when bot token is not set).
	pollingCtx, stopPolling := context.WithCancel(context.Background())
	go telegramBotService.StartPolling(pollingCtx)

	p2pFeePercent := decimal.NewFromFloat(cfg.P2PFee.FeePercent)
	p2pService := service.NewP2PService(p2pAdRepo, currencyRepo, priceService, referralService, p2pFeePercent, emailSender, anomalyService)
	notificationService := service.NewNotificationService(notificationRepo)
	reviewService := service.NewReviewService(reviewRepo)

	aiAgentService := service.NewAIAgentService(priceService)
	adminUserService := service.NewAdminUserService(userRepo, kycRepo, walletRepo)
	adminRevenueService := service.NewAdminRevenueService(revenueRepo)
	adminKYCService := service.NewAdminKYCService(kycRepo)
	adminWithdrawalLimitService := service.NewAdminWithdrawalLimitService(kycRepo, withdrawalLimitRepo, cache.Client)

	// Initialize handlers
	healthHandler := handler.NewHealthHandler()
	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(userService, walletService)
	notificationHandler := handler.NewNotificationHandler(notificationService)
	p2pHandler := handler.NewP2PHandler(p2pService, priceService, currencyRepo, p2pFeePercent)
	adminRefHandler := handler.NewAdminReferenceHandler(networkRepo, currencyRepo)
	referenceHandler := handler.NewReferenceHandler(currencyRepo, networkRepo, priceService, feeService)
	kycHandler := handler.NewKYCHandler(kycService, cloudinaryClient, cfg.Cloudinary.Folder)
	referralHandler := handler.NewReferralHandler(referralService)
	reviewHandler := handler.NewReviewHandler(reviewService)
	adminUserHandler := handler.NewAdminUserHandler(adminUserService, p2pService)
	adminRevenueHandler := handler.NewAdminRevenueHandler(adminRevenueService)
	adminKYCHandler := handler.NewAdminKYCHandler(adminKYCService)
	adminWithdrawalLimitHandler := handler.NewAdminWithdrawalLimitHandler(adminWithdrawalLimitService)
	communityLinkHandler := handler.NewCommunityLinkHandler(communityLinkRepo)
	agentHandler := handler.NewAgentHandler(aiAgentService)
	telegramHandler := handler.NewTelegramHandler(cfg.Telegram, telegramBotService)

	// Setup router
	r := router.NewRouter(cfg, healthHandler, authHandler, userHandler, notificationHandler, p2pHandler, adminRefHandler, adminUserHandler, adminRevenueHandler, adminKYCHandler, adminWithdrawalLimitHandler, communityLinkHandler, referenceHandler, kycHandler, referralHandler, reviewHandler, agentHandler, telegramHandler)
	engine := r.Setup()

	// Create HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.App.Port,
		Handler:      engine,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		logger.Info("Server starting", zap.String("address", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Stop Telegram polling goroutine.
	stopPolling()

	// Graceful shutdown with 5 second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server exited")
}
