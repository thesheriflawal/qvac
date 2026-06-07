package utils

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

// NormalizeEmail trims and lowercases email for consistent lookups.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// Generate6DigitOTP returns a zero-padded 6 digit OTP.
func Generate6DigitOTP() (string, error) {
	// crypto/rand in range [0, 1000000)
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// Generate14DigitUID returns a zero-padded 14-digit numeric string suitable for
// use as a public identifier (e.g. for users or internal transfers).
func Generate14DigitUID() (string, error) {
	// Upper bound is 10^14.
	max := new(big.Int).Exp(big.NewInt(10), big.NewInt(14), nil)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%014d", n), nil
}

// Generate20DigitUID returns a zero-padded 20-digit numeric string suitable for
// use as a public order number.
func Generate20DigitUID() (string, error) {
	// Upper bound is 10^20.
	max := new(big.Int).Exp(big.NewInt(10), big.NewInt(20), nil)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%020d", n), nil
}

// HashOTP produces a keyed HMAC-SHA256 of the OTP bound to the email address.
// Using HMAC rather than plain SHA-256 means offline brute-force requires
// knowledge of the server secret even for the tiny 6-digit keyspace.
func HashOTP(email, otp, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(email + ":" + otp))
	return hex.EncodeToString(mac.Sum(nil))
}

// GenerateTOTPKey creates a new TOTP key compatible with Google Authenticator.
// The caller should persist key.Secret() (e.g. in UserSecurity.TwoFASecret) and
// use key.URL() to render a QR code for enrollment.
func GenerateTOTPKey(issuer, accountName string) (*otp.Key, error) {
	issuer = strings.TrimSpace(issuer)
	accountName = strings.TrimSpace(accountName)
	if issuer == "" || accountName == "" {
		return nil, fmt.Errorf("issuer and accountName are required")
	}

	return totp.Generate(totp.GenerateOpts{
		Issuer:      issuer,
		AccountName: accountName,
		Period:      30,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
}

// ValidateTOTPCode verifies a 6-digit TOTP code against the given secret.
// It allows a small time skew to account for clock drift.
func ValidateTOTPCode(secret, code string) bool {
	secret = strings.TrimSpace(secret)
	code = strings.TrimSpace(code)
	if secret == "" || code == "" {
		return false
	}

	// Allow +/- 1 step (30s) clock skew.
	valid, err := totp.ValidateCustom(code, secret, time.Now().UTC(), totp.ValidateOpts{
		Period:    30,
		Skew:      1,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})

	if err != nil {
		return false
	}
	return valid
}
