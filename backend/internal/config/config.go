package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	App        AppConfig
	Database   DatabaseConfig
	Redis      RedisConfig
	JWT        JWTConfig
	Session    SessionConfig
	CORS       CORSConfig
	RateLimit  RateLimitConfig
	Log        LogConfig
	Resend     ResendConfig
	Cloudinary CloudinaryConfig
	GoogleAuth GoogleAuthConfig
	AppleAuth  AppleAuthConfig
	CoinGecko  CoinGeckoConfig
	P2PFee     P2PFeeConfig
	Telegram   TelegramConfig
}

type AppConfig struct {
	Env              string
	Port             string
	Name             string
	KYCEncryptionKey  string
	KYCBlindIndexKey  string
	// TrustedProxies is the list of CIDR ranges or IPs of reverse proxies that
	// are allowed to set X-Forwarded-For / X-Real-IP headers. An empty slice
	// means "trust no proxies" — Gin uses the raw TCP connection IP, making
	// the header completely unspoofable. Set this to your ALB/Cloudflare/Nginx
	// CIDR in production (e.g. "10.0.0.0/8,172.16.0.0/12").
	TrustedProxies []string
	// PINPepper is a high-entropy server-side secret mixed into every PIN hash
	// via HMAC-SHA256 before bcrypt. Without it an attacker who reads the
	// database can enumerate all 10^6 PIN values offline in minutes.
	// Generate with: openssl rand -hex 32
	PINPepper string
}

type DatabaseConfig struct {
	Host        string
	Port        string
	User        string
	Password    string
	Name        string
	SSLMode     string
	AutoMigrate bool
}

type RedisConfig struct {
	Enabled  bool
	Host     string
	Port     string
	Password string
	DB       int
}

type JWTConfig struct {
	Secret            string
	Expiration        time.Duration
	RefreshSecret     string
	RefreshExpiration time.Duration
	PreviousSecret    string // optional: used during secret rotation
	Issuer            string // "iss" claim embedded in every token and validated on parse
	Audience          string // "aud" claim embedded in every token and validated on parse
}

type SessionConfig struct {
	// InactivityTimeout is how long a session can be idle before it expires.
	// Each authenticated request resets the timer. Default: 30m.
	InactivityTimeout time.Duration
}

type CORSConfig struct {
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string
}

type RateLimitConfig struct {
	Requests int
	Duration time.Duration
}

type LogConfig struct {
	Level  string
	Format string
}

type ResendConfig struct {
	APIKey string
	From   string
}

type CloudinaryConfig struct {
	CloudName string
	APIKey    string
	APISecret string
	Folder    string // Optional: default folder for KYC uploads
}

// GoogleAuthConfig holds configuration for Google ID token verification.
type GoogleAuthConfig struct {
	// ClientIDs is the list of allowed OAuth client IDs. If empty, Google login
	// is considered disabled.
	ClientIDs []string
}

// AppleAuthConfig holds configuration for Sign in with Apple ID token verification.
type AppleAuthConfig struct {
	// ClientID is the expected audience ("aud") value in Apple ID tokens. If
	// empty, Apple login is considered disabled.
	ClientID string
}

// CoinGeckoConfig holds configuration for CoinGecko price API.
type CoinGeckoConfig struct {
	APIKey  string
	BaseURL string
}

// P2PFeeConfig holds configuration for P2P trade fees.
type P2PFeeConfig struct {
	// FeePercent is the percentage charged to the advertiser per trade.
	// For example, 0.2 means 0.2%.
	FeePercent float64
}

// TelegramConfig holds configuration for the Telegram bot integration.
type TelegramConfig struct {
	BotToken      string // from @BotFather
	AdminChatID   int64  // chat ID that always receives alerts (0 = disabled)
	WebhookSecret string // optional X-Telegram-Bot-Api-Secret-Token validation
}

// Load reads configuration from environment variables
func Load() (*Config, error) {
	viper.SetConfigFile(".env")
	viper.AutomaticEnv()

	// Allow running without .env file (useful for production with env vars)
	if err := viper.ReadInConfig(); err != nil {
		var configFileNotFoundError viper.ConfigFileNotFoundError
		if !errors.As(err, &configFileNotFoundError) && !os.IsNotExist(err) {
			return nil, fmt.Errorf("error reading config file: %w", err)
		}
	}

	// Set defaults
	setDefaults()

	config := &Config{
		App: AppConfig{
			Env:              viper.GetString("APP_ENV"),
			Port:             viper.GetString("APP_PORT"),
			Name:             viper.GetString("APP_NAME"),
			KYCEncryptionKey: viper.GetString("KYC_ENCRYPTION_KEY"),
			KYCBlindIndexKey: viper.GetString("KYC_BLIND_INDEX_KEY"),
			TrustedProxies:   parseCommaSeparated(viper.GetString("TRUSTED_PROXIES")),
			PINPepper:        viper.GetString("PIN_PEPPER"),
		},
		Database: DatabaseConfig{
			Host:        viper.GetString("DB_HOST"),
			Port:        viper.GetString("DB_PORT"),
			User:        viper.GetString("DB_USER"),
			Password:    viper.GetString("DB_PASSWORD"),
			Name:        viper.GetString("DB_NAME"),
			SSLMode:     viper.GetString("DB_SSLMODE"),
			AutoMigrate: viper.GetBool("DB_AUTO_MIGRATE"),
		},
		Redis: RedisConfig{
			Enabled:  viper.GetBool("REDIS_ENABLED"),
			Host:     viper.GetString("REDIS_HOST"),
			Port:     viper.GetString("REDIS_PORT"),
			Password: viper.GetString("REDIS_PASSWORD"),
			DB:       viper.GetInt("REDIS_DB"),
		},
		JWT: JWTConfig{
			Secret:            viper.GetString("JWT_SECRET"),
			Expiration:        viper.GetDuration("JWT_EXPIRATION"),
			RefreshSecret:     viper.GetString("JWT_REFRESH_SECRET"),
			RefreshExpiration: viper.GetDuration("JWT_REFRESH_EXPIRATION"),
			PreviousSecret:    viper.GetString("JWT_PREVIOUS_SECRET"),
			Issuer:            viper.GetString("JWT_ISSUER"),
			Audience:          viper.GetString("JWT_AUDIENCE"),
		},
		Session: SessionConfig{
			InactivityTimeout: viper.GetDuration("SESSION_INACTIVITY_TIMEOUT"),
		},
		CORS: CORSConfig{
			AllowedOrigins: splitCSV(viper.GetString("CORS_ALLOWED_ORIGINS")),
			AllowedMethods: splitCSV(viper.GetString("CORS_ALLOWED_METHODS")),
			AllowedHeaders: splitCSV(viper.GetString("CORS_ALLOWED_HEADERS")),
		},
		RateLimit: RateLimitConfig{
			Requests: viper.GetInt("RATE_LIMIT_REQUESTS"),
			Duration: viper.GetDuration("RATE_LIMIT_DURATION"),
		},
		Log: LogConfig{
			Level:  viper.GetString("LOG_LEVEL"),
			Format: viper.GetString("LOG_FORMAT"),
		},
		Resend: ResendConfig{
			APIKey: viper.GetString("RESEND_API_KEY"),
			From:   viper.GetString("RESEND_FROM"),
		},
		Cloudinary: CloudinaryConfig{
			CloudName: viper.GetString("CLOUDINARY_CLOUD_NAME"),
			APIKey:    viper.GetString("CLOUDINARY_API_KEY"),
			APISecret: viper.GetString("CLOUDINARY_API_SECRET"),
			Folder:    viper.GetString("CLOUDINARY_FOLDER"),
		},
		GoogleAuth: GoogleAuthConfig{
			ClientIDs: parseCommaSeparated(viper.GetString("GOOGLE_CLIENT_IDS")),
		},
		AppleAuth: AppleAuthConfig{
			ClientID: viper.GetString("APPLE_CLIENT_ID"),
		},
		CoinGecko: CoinGeckoConfig{
			APIKey:  viper.GetString("COINGECKO_API_KEY"),
			BaseURL: viper.GetString("COINGECKO_BASE_URL"),
		},
		P2PFee: P2PFeeConfig{
			FeePercent: viper.GetFloat64("P2P_FEE_PERCENT"),
		},
		Telegram: TelegramConfig{
			BotToken:      viper.GetString("TELEGRAM_BOT_TOKEN"),
			AdminChatID:   viper.GetInt64("TELEGRAM_ADMIN_CHAT_ID"),
			WebhookSecret: viper.GetString("TELEGRAM_WEBHOOK_SECRET"),
		},
	}

	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return config, nil
}

func parseCommaKeyValue(s string) map[string]string {
	m := map[string]string{}
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		k := strings.ToLower(strings.TrimSpace(kv[0]))
		v := strings.TrimSpace(kv[1])
		if k == "" || v == "" {
			continue
		}
		m[k] = v
	}
	return m
}

// parseCommaSeparated splits a comma-separated string into a slice of trimmed,
// non-empty values.
func parseCommaSeparated(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		out = append(out, part)
	}
	return out
}

func setDefaults() {
	viper.SetDefault("APP_ENV", "development")
	viper.SetDefault("APP_PORT", "8080")
	viper.SetDefault("APP_NAME", "Kynettic API")
	viper.SetDefault("DB_PORT", "5432")
	viper.SetDefault("DB_SSLMODE", "require")
	viper.SetDefault("DB_AUTO_MIGRATE", true)
	viper.SetDefault("REDIS_ENABLED", true)
	viper.SetDefault("REDIS_HOST", "localhost")
	viper.SetDefault("REDIS_PORT", "6379")
	viper.SetDefault("REDIS_PASSWORD", "")
	viper.SetDefault("REDIS_DB", 0)
	viper.SetDefault("JWT_EXPIRATION", "24h")
	viper.SetDefault("JWT_REFRESH_EXPIRATION", "168h")
	viper.SetDefault("SESSION_INACTIVITY_TIMEOUT", "30m")
	viper.SetDefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:8080,https://www.kynettic.com,https://kynettic.com")
	viper.SetDefault("CORS_ALLOWED_METHODS", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
	viper.SetDefault("CORS_ALLOWED_HEADERS", "Origin,Content-Type,Accept,Authorization,Idempotency-Key")
	viper.SetDefault("RATE_LIMIT_REQUESTS", 100)
	viper.SetDefault("RATE_LIMIT_DURATION", "1m")
	viper.SetDefault("LOG_LEVEL", "info")
	viper.SetDefault("LOG_FORMAT", "json")
	viper.SetDefault("RESEND_FROM", "Kynettic <onboarding@resend.dev>")
	viper.SetDefault("CLOUDINARY_FOLDER", "kyc")
	viper.SetDefault("COINGECKO_BASE_URL", "https://api.coingecko.com/api/v3")
	viper.SetDefault("P2P_FEE_PERCENT", 0.2)
}

// Validate checks if required configuration values are present
func (c *Config) Validate() error {
	if c.Database.Host == "" {
		return fmt.Errorf("DB_HOST is required")
	}
	if c.Database.User == "" {
		return fmt.Errorf("DB_USER is required")
	}
	if c.Database.Password == "" {
		return fmt.Errorf("DB_PASSWORD is required")
	}
	if c.Database.Name == "" {
		return fmt.Errorf("DB_NAME is required")
	}

	if c.App.KYCEncryptionKey == "" {
		return fmt.Errorf("KYC_ENCRYPTION_KEY is required")
	}
	if err := validateSecretStrength("KYC_ENCRYPTION_KEY", c.App.KYCEncryptionKey); err != nil {
		return err
	}

	if c.App.KYCBlindIndexKey == "" {
		return fmt.Errorf("KYC_BLIND_INDEX_KEY is required")
	}
	if err := validateSecretStrength("KYC_BLIND_INDEX_KEY", c.App.KYCBlindIndexKey); err != nil {
		return err
	}

	if c.App.PINPepper == "" {
		return fmt.Errorf("PIN_PEPPER is required")
	}
	if err := validateSecretStrength("PIN_PEPPER", c.App.PINPepper); err != nil {
		return err
	}

	if c.Redis.Enabled {
		if c.Redis.Host == "" {
			return fmt.Errorf("REDIS_HOST is required")
		}
	}
	if c.JWT.Secret == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}
	if c.JWT.RefreshSecret == "" {
		return fmt.Errorf("JWT_REFRESH_SECRET is required")
	}

	// Enforce strong JWT secrets to prevent token forgery.
	if err := validateSecretStrength("JWT_SECRET", c.JWT.Secret); err != nil {
		return err
	}
	if err := validateSecretStrength("JWT_REFRESH_SECRET", c.JWT.RefreshSecret); err != nil {
		return err
	}

	// Validate every TRUSTED_PROXIES entry is a well-formed IP or CIDR.
	for _, entry := range c.App.TrustedProxies {
		if _, _, err := net.ParseCIDR(entry); err != nil {
			if net.ParseIP(entry) == nil {
				return fmt.Errorf("TRUSTED_PROXIES entry %q is not a valid IP address or CIDR range", entry)
			}
		}
	}

	// Email is optional — OTP flows are disabled when Redis is off.
	if c.Resend.From == "" {
		return fmt.Errorf("RESEND_FROM is required")
	}

	return nil
}

// validateSecretStrength ensures that a secret is sufficiently strong for cryptographic use.
// It enforces a minimum length and rejects obviously weak placeholder values.
func validateSecretStrength(name, value string) error {
	if len(value) < 32 {
		return fmt.Errorf("%s must be at least 32 characters long", name)
	}

	lower := strings.ToLower(value)
	weakSubstrings := []string{"secret", "changeme", "password", "jwt", "refresh", "your-super-secret"}
	for _, ws := range weakSubstrings {
		if strings.Contains(lower, ws) {
			return fmt.Errorf("%s is too weak and appears to use a placeholder; generate a high-entropy value", name)
		}
	}

	return nil
}

// validateExternalBaseURL validates that an external API base URL is well-formed and, in production,
// restricted to a known set of hosts. It also blocks private, loopback, and link-local addresses to
// reduce SSRF risk.
func validateExternalBaseURL(name, rawURL string, isProd bool, allowedHosts []string) error {
	if rawURL == "" {
		// Allow empty in non-production environments to ease local development.
		if isProd {
			return fmt.Errorf("%s is required in production", name)
		}
		return nil
	}

	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("%s is not a valid URL: %w", name, err)
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return fmt.Errorf("%s must use http or https scheme", name)
	}

	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("%s must include a host", name)
	}

	if isProd && len(allowedHosts) > 0 {
		allowed := false
		for _, h := range allowedHosts {
			if strings.EqualFold(host, h) {
				allowed = true
				break
			}
		}
		if !allowed {
			return fmt.Errorf("%s host %q is not in the allowed list for production", name, host)
		}
	}

	// Block literal private/loopback IPs directly.
	if ip := net.ParseIP(host); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || host == "169.254.169.254" {
			return fmt.Errorf("%s host %q is a private or link-local address, which is not allowed", name, host)
		}
		return nil
	}

	// For hostnames, resolve DNS and check every returned address. This prevents
	// bypass via domains like "127.0.0.1.nip.io" that resolve to private IPs.
	addrs, err := net.LookupHost(host)
	if err != nil {
		// In production a lookup failure is fatal: we cannot verify the host is safe.
		// In non-production it may just mean no DNS is available (offline dev), so allow it.
		if isProd {
			return fmt.Errorf("%s host %q could not be resolved: %w", name, host, err)
		}
		return nil
	}
	for _, addr := range addrs {
		ip := net.ParseIP(addr)
		if ip == nil {
			continue
		}
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || addr == "169.254.169.254" {
			return fmt.Errorf("%s host %q resolves to a private or link-local address (%s), which is not allowed", name, host, addr)
		}
	}

	return nil
}

// splitCSV splits a comma-separated string into a trimmed slice.
// This is used instead of viper.GetStringSlice because Viper reads env vars
// as a single string, not a proper slice, causing the entire value to be treated
// as one element.
func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}

// IsDevelopment returns true if running in development mode
func (c *Config) IsDevelopment() bool {
	return c.App.Env == "development"
}

// IsProduction returns true if running in production mode
func (c *Config) IsProduction() bool {
	return c.App.Env == "production"
}

// GetDSN returns the database connection string in URL format so that special
// characters in the password or username are percent-encoded and cannot inject
// extra key=value pairs into a space-delimited DSN.
func (c *Config) GetDSN() string {
	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(c.Database.User, c.Database.Password),
		Host:   net.JoinHostPort(c.Database.Host, c.Database.Port),
		Path:   "/" + c.Database.Name,
	}
	q := u.Query()
	q.Set("sslmode", c.Database.SSLMode)
	q.Set("search_path", "public")
	u.RawQuery = q.Encode()
	return u.String()
}
