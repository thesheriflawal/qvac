package router

import (
	"net/http"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/handler"
	"github.com/Kynettic-org/kynettic-backend/internal/middleware"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

const maxRequestBodyBytes = 1 << 20 // 1 MiB global request body limit

// Router holds all handlers and configuration
type Router struct {
	config                *config.Config
	healthHandler         *handler.HealthHandler
	authHandler           *handler.AuthHandler
	userHandler           *handler.UserHandler
	notificationHandler   *handler.NotificationHandler
	p2pHandler            *handler.P2PHandler
	adminReferenceHandler        *handler.AdminReferenceHandler
	adminUserHandler             *handler.AdminUserHandler
	adminRevenueHandler          *handler.AdminRevenueHandler
	adminKYCHandler              *handler.AdminKYCHandler
	adminWithdrawalLimitHandler  *handler.AdminWithdrawalLimitHandler
	communityLinkHandler         *handler.CommunityLinkHandler
	referenceHandler      *handler.ReferenceHandler
	kycHandler            *handler.KYCHandler
	referralHandler       *handler.ReferralHandler
	reviewHandler         *handler.ReviewHandler
	agentHandler          *handler.AgentHandler
	telegramHandler       *handler.TelegramHandler
}

// NewRouter creates a new router instance
func NewRouter(
	cfg *config.Config,
	healthHandler *handler.HealthHandler,
	authHandler *handler.AuthHandler,
	userHandler *handler.UserHandler,
	notificationHandler *handler.NotificationHandler,
	p2pHandler *handler.P2PHandler,
	adminReferenceHandler *handler.AdminReferenceHandler,
	adminUserHandler *handler.AdminUserHandler,
	adminRevenueHandler *handler.AdminRevenueHandler,
	adminKYCHandler *handler.AdminKYCHandler,
	adminWithdrawalLimitHandler *handler.AdminWithdrawalLimitHandler,
	communityLinkHandler *handler.CommunityLinkHandler,
	referenceHandler *handler.ReferenceHandler,
	kycHandler *handler.KYCHandler,
	referralHandler *handler.ReferralHandler,
	reviewHandler *handler.ReviewHandler,
	agentHandler *handler.AgentHandler,
	telegramHandler *handler.TelegramHandler,
) *Router {
	return &Router{
		config:                cfg,
		healthHandler:         healthHandler,
		authHandler:           authHandler,
		userHandler:           userHandler,
		notificationHandler:   notificationHandler,
		p2pHandler:            p2pHandler,
		adminReferenceHandler:       adminReferenceHandler,
		adminUserHandler:            adminUserHandler,
		adminRevenueHandler:         adminRevenueHandler,
		adminKYCHandler:             adminKYCHandler,
		adminWithdrawalLimitHandler: adminWithdrawalLimitHandler,
		communityLinkHandler:        communityLinkHandler,
		referenceHandler:            referenceHandler,
		kycHandler:            kycHandler,
		referralHandler:       referralHandler,
		reviewHandler:         reviewHandler,
		agentHandler:          agentHandler,
		telegramHandler:       telegramHandler,
	}
}

// Setup configures all routes
func (r *Router) Setup() *gin.Engine {
	// Set Gin mode
	if r.config.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	router := gin.New()

	// Configure trusted reverse proxies. An empty/nil list means "trust no
	// proxies" — Gin reads the raw TCP connection IP and ignores
	// X-Forwarded-For / X-Real-IP, preventing IP spoofing of rate limits.
	// Set TRUSTED_PROXIES in config to your ALB/Cloudflare CIDRs in production.
	if len(r.config.App.TrustedProxies) > 0 {
		if err := router.SetTrustedProxies(r.config.App.TrustedProxies); err != nil {
			panic("invalid TRUSTED_PROXIES configuration: " + err.Error())
		}
	} else {
		_ = router.SetTrustedProxies(nil)
	}

	// Stash the original request body before the global MaxBytesReader wraps it.
	// File-upload handlers (e.g. KYC tier3) retrieve this via the context key
	// "rawRequestBody" and re-wrap it with a higher, endpoint-specific limit so
	// they do not inherit the global 1 MiB cap (which is too small for images)
	// while all other endpoints remain protected by the global cap below.
	router.Use(func(c *gin.Context) {
		c.Set("rawRequestBody", c.Request.Body)
		c.Next()
	})

	// Global request body size limit to mitigate OOM/DoS from large payloads.
	router.Use(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxRequestBodyBytes)
		c.Next()
	})

	// Apply global middleware
	router.Use(middleware.RequestID())
	router.Use(middleware.Recovery())
	router.Use(middleware.Logger())
	router.Use(middleware.CORS(r.config))
	router.Use(middleware.RateLimit(r.config))

	// Enforce HSTS in production so browsers always use HTTPS.
	// max-age=31536000 (1 year) with includeSubDomains is the recommended baseline.
	if r.config.IsProduction() {
		router.Use(func(c *gin.Context) {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			c.Next()
		})
	}

	// Health check endpoint (no versioning)
	router.GET("/health", r.healthHandler.Check)

	// Telegram bot webhook (no versioning, validated via X-Telegram-Bot-Api-Secret-Token)
	if r.telegramHandler != nil {
		router.POST("/webhooks/telegram", r.telegramHandler.HandleWebhook)
	}

	// Swagger documentation
	// In production, we disable Swagger UI for security hardening as recommended by the audit.
	if !r.config.IsProduction() {
		// Redirect directory-style hits (/swagger, /swagger/) to the actual UI entrypoint.
		// Note: Gin treats wildcard routes and explicit "/swagger/" routes as conflicting,
		// so we do this via middleware instead of registering separate routes.
		router.Use(func(c *gin.Context) {
			if c.Request.Method == http.MethodGet {
				p := c.Request.URL.Path
				if p == "/swagger" || p == "/swagger/" {
					c.Redirect(http.StatusFound, "/swagger/index.html")
					c.Abort()
					return
				}
			}
			c.Next()
		})
		router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Reference routes (public)
		v1.GET("/currencies", r.referenceHandler.ListCurrencies)
		v1.GET("/currencies/:currency_id/networks", r.referenceHandler.ListCurrencyNetworks)
		v1.GET("/currencies/:currency_id/price", r.referenceHandler.GetCurrencyPrice)
		v1.GET("/networks", r.referenceHandler.ListNetworks)
		v1.GET("/withdrawal-fees", r.referenceHandler.GetWithdrawalFees)
		v1.GET("/withdrawal-fees/crypto", r.referenceHandler.GetCryptoWithdrawalFee)

		// Review routes (public)
		v1.POST("/reviews", r.reviewHandler.SubmitReview)
		v1.GET("/reviews", r.reviewHandler.ListReviews)

		// Auth routes (public)
		auth := v1.Group("/auth")
		{
			// Registration (OTP first, then password)
			auth.POST("/register/request-otp", middleware.IPRateLimit("rl:reg_req_otp", 5, time.Minute), r.authHandler.RequestRegistrationOTP)
			auth.POST("/register/resend-otp", middleware.IPRateLimit("rl:reg_resend_otp", 5, time.Minute), r.authHandler.ResendRegistrationOTP)
			auth.POST("/register/verify-otp", middleware.IPRateLimit("rl:reg_verify_otp", 10, time.Minute), r.authHandler.VerifyRegistrationOTP)
			auth.POST("/register/set-password", r.authHandler.SetPassword)

			auth.POST("/forgot-password/request-otp", middleware.IPRateLimit("rl:fp_req_otp", 5, time.Minute), r.authHandler.ForgotPasswordRequestOTP)
			auth.POST("/forgot-password/resend-otp", middleware.IPRateLimit("rl:fp_resend_otp", 5, time.Minute), r.authHandler.ResendForgotPasswordOTP)
			auth.POST("/forgot-password/verify-otp", middleware.IPRateLimit("rl:fp_verify_otp", 10, time.Minute), r.authHandler.ForgotPasswordVerifyOTP)
			auth.POST("/forgot-password/reset", r.authHandler.ForgotPasswordReset)

			auth.POST("/login", r.authHandler.Login)
			auth.POST("/2fa/verify", middleware.IPRateLimit("rl:2fa_verify", 10, time.Minute), r.authHandler.VerifyTwoFA)
			auth.POST("/2fa/login", r.authHandler.LoginWith2FA)
			auth.POST("/refresh", r.authHandler.RefreshToken)
			auth.POST("/google", r.authHandler.LoginWithGoogle)
			auth.POST("/apple", r.authHandler.LoginWithApple)

			// Logout (requires valid token)
			auth.POST("/logout", middleware.Auth(r.config), r.authHandler.Logout)
		}

		// Admin routes
		admin := v1.Group("/admin")
		admin.Use(middleware.Auth(r.config))
		admin.Use(middleware.RequireRole(models.RoleAdmin))
		{
			admin.POST("/networks", r.adminReferenceHandler.CreateNetwork)
			admin.POST("/currencies", r.adminReferenceHandler.CreateCurrency)
			admin.POST("/notifications/broadcast", r.notificationHandler.Broadcast)

			// Referral admin routes
			if r.referralHandler != nil {
				admin.GET("/referrals", r.referralHandler.AdminListAllReferrals)
				admin.GET("/referrals/user/:user_id", r.referralHandler.AdminListReferralsByUser)
				admin.GET("/referral/config", r.referralHandler.ListReferralConfigs)
				admin.PUT("/referral/config", r.referralHandler.UpdateReferralConfig)
				admin.POST("/referral/claim-cycles", r.referralHandler.OpenClaimCycle)
				admin.GET("/referral/claim-cycles", r.referralHandler.ListClaimCycles)
				admin.PATCH("/referral/claim-cycles/:id", r.referralHandler.CloseClaimCycle)
			}

			// Admin P2P routes
			if r.adminUserHandler != nil {
				admin.GET("/p2p/orders", r.adminUserHandler.ListAdminOrders)
				admin.GET("/p2p/top-traders", r.adminUserHandler.ListTopTraders)
			}

			// Admin user management routes
			if r.adminUserHandler != nil {
				admin.GET("/users", r.adminUserHandler.ListUsers)
				admin.GET("/users/:id", r.adminUserHandler.GetUserDetail)
				admin.PATCH("/users/:id/status", r.adminUserHandler.SetUserStatus)
			}

			// Admin withdrawal limit routes
			if r.adminWithdrawalLimitHandler != nil {
				admin.GET("/users/:id/withdrawal-limit", r.adminWithdrawalLimitHandler.GetUserLimit)
				admin.POST("/users/:id/withdrawal-limit/override", r.adminWithdrawalLimitHandler.SetOverride)
				admin.DELETE("/users/:id/withdrawal-limit/override", r.adminWithdrawalLimitHandler.RemoveOverride)
			}

			// Admin revenue dashboard routes
			if r.adminRevenueHandler != nil {
				admin.GET("/revenue/summary", r.adminRevenueHandler.GetSummary)
				admin.GET("/revenue/fees", r.adminRevenueHandler.GetDailyFees)
			}

			// Admin KYC queue routes
			if r.adminKYCHandler != nil {
				admin.GET("/kyc", r.adminKYCHandler.ListKYCVerifications)
				admin.GET("/kyc/:user_id", r.adminKYCHandler.GetKYCVerification)
			}

			// Community link admin routes
			if r.communityLinkHandler != nil {
				admin.POST("/community-links", r.communityLinkHandler.UpsertLink)
			}

		}

		// Community links (authenticated, any role)
		if r.communityLinkHandler != nil {
			communityLinks := v1.Group("/community-links")
			communityLinks.Use(middleware.Auth(r.config))
			communityLinks.GET("", r.communityLinkHandler.ListLinks)
		}

		// User routes (protected)
		users := v1.Group("/users")
		users.Use(middleware.Auth(r.config))
		{
			// Current user routes
			users.GET("/me", r.userHandler.GetProfile)
			users.PUT("/me", r.userHandler.UpdateProfile)
			users.POST("/me/email-change/request",
				middleware.UserRateLimit("rl:email_change_req", 5, time.Minute),
				r.userHandler.RequestEmailChangeOTP,
			)
			users.POST("/me/email-change/confirm", r.userHandler.ConfirmEmailChange)
			users.POST("/me/change-password", r.userHandler.ChangePassword)
			users.POST("/me/pin/setup", r.userHandler.SetupPIN)
			users.POST("/me/pin/change",
				middleware.UserRateLimit("rl:pin_change", 5, time.Minute),
				r.userHandler.ChangePIN,
			)
			users.POST("/me/2fa/setup", r.userHandler.SetupTwoFA)
			users.POST("/me/2fa/enable", r.userHandler.EnableTwoFA)
			users.POST("/me/2fa/disable",
				middleware.UserRateLimit("rl:2fa_disable", 5, time.Minute),
				r.userHandler.DisableTwoFA,
			)
			users.GET("/me/wallet-address", r.userHandler.GetWalletAddress)
			users.GET("/me/deposit-account", r.userHandler.GetOrCreateDepositAccount)
			users.GET("/me/fiat-banks", r.userHandler.ListFiatBanks)
			users.POST("/me/fiat-bank-lookup",
				middleware.UserRateLimit("rl:bank_lookup", 10, time.Minute),
				r.userHandler.LookupFiatBankAccount,
			)
			users.GET("/me/wallets", r.userHandler.ListWallets)
			users.GET("/me/wallet-transactions", r.userHandler.ListWalletTransactions)
			users.DELETE("/me",
				middleware.UserRateLimit("rl:delete_account", 5, time.Minute),
				r.userHandler.DeleteMyAccount,
			)

			// Transfer routes with idempotency + 5-second cooldown to prevent double payments
			transfers := users.Group("")
			transfers.Use(middleware.Idempotency())
			transfers.Use(middleware.TransferCooldown(5 * time.Second))
			{
				transfers.POST("/me/crypto-withdrawals", r.userHandler.CryptoWithdraw)
				transfers.POST("/me/fiat-withdrawals", r.userHandler.FiatWithdraw)
				transfers.POST("/me/internal-transfer", r.userHandler.InternalTransfer)
			}
			users.GET("/me/notifications", r.notificationHandler.ListMyNotifications)
			users.PATCH("/me/notifications/:id/read", r.notificationHandler.MarkNotificationAsRead)
			users.PATCH("/me/notifications/read-all", r.notificationHandler.MarkAllNotificationsAsRead)

			// Referral routes
			if r.referralHandler != nil {
				users.GET("/me/referral", r.referralHandler.GetMyReferralInfo)
				users.GET("/me/referrals", r.referralHandler.ListMyReferrals)
				users.GET("/me/referral/points", r.referralHandler.ListMyPointTransactions)
				users.POST("/me/referral/claim", middleware.Idempotency(), r.referralHandler.ClaimReward)
				users.GET("/me/referral/claims", r.referralHandler.ListMyClaims)
				users.GET("/me/referral/leaderboard", r.referralHandler.GetLeaderboard)
			}

			// KYC routes
			if r.kycHandler != nil {
				kyc := users.Group("/me/kyc")
				{
					kyc.GET("/status", r.kycHandler.GetStatus)
					kyc.POST("/tier1",
						middleware.UserRateLimit("rl:kyc_tier1", 5, 10*time.Minute),
						r.kycHandler.SubmitTier1,
					)
					kyc.POST("/tier2",
						middleware.UserRateLimit("rl:kyc_tier2", 5, 10*time.Minute),
						r.kycHandler.SubmitTier2,
					)
					kyc.POST("/tier3", r.kycHandler.SubmitTier3)
				}
			}

			// Admin routes
			admin := users.Group("")
			admin.Use(middleware.RequireRole(models.RoleAdmin))
			{
				admin.GET("", r.userHandler.ListUsers)
				admin.GET("/:id", r.userHandler.GetUser)
				admin.DELETE("/:id", r.userHandler.DeleteUser)
			}
		}

		// AI Agent routes (protected)
		if r.agentHandler != nil {
			agents := v1.Group("/agents")
			agents.Use(middleware.Auth(r.config))
			{
				agents.POST("", r.agentHandler.CreateAgent)
				agents.GET("", r.agentHandler.ListAgents)
				agents.GET("/:id", r.agentHandler.GetAgent)
				agents.PATCH("/:id/status", r.agentHandler.UpdateAgentStatus)
				agents.GET("/:id/context",
					middleware.UserRateLimit("rl:agent_ctx", 30, time.Minute),
					r.agentHandler.GetMarketContext,
				)
				agents.POST("/:id/decisions",
					middleware.UserRateLimit("rl:agent_decision", 20, time.Minute),
					r.agentHandler.SubmitDecision,
				)
				agents.GET("/:id/decisions", r.agentHandler.ListDecisions)
				agents.GET("/:id/performance", r.agentHandler.GetPerformanceSummary)
			}
		}

		// P2P routes (protected)
		if r.p2pHandler != nil {
			p2p := v1.Group("/p2p")
			p2p.Use(middleware.Auth(r.config))
			{
				p2p.GET("/fees", r.p2pHandler.GetFees)
				p2p.GET("/ads", r.p2pHandler.ListAds)
				p2p.GET("/my-ads", r.p2pHandler.ListMyAds)
				p2p.POST("/ads",
					middleware.UserRateLimit("rl:p2p_create_ad", 20, time.Minute),
					r.p2pHandler.CreateAd,
				)
				p2p.PATCH("/ads/:id", r.p2pHandler.UpdateAd)
				p2p.DELETE("/ads/:id", r.p2pHandler.DeleteAd)
				p2p.GET("/orders", r.p2pHandler.ListMyOrders)
				p2p.POST("/orders",
					middleware.Idempotency(),
					middleware.UserRateLimit("rl:p2p_execute_trade", 20, time.Minute),
					r.p2pHandler.ExecuteTrade,
				)
			}
		}
	}

	return router
}
