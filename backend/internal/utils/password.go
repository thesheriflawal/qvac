package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"strings"
	"unicode"

	"golang.org/x/crypto/bcrypt"
)

// preHashedPasswordPrefix marks hashes produced with the SHA-256 pre-hashing
// scheme. Legacy bcrypt hashes without this prefix are still accepted so that
// existing users can log in; their hash is silently upgraded on next password
// change or reset.
const preHashedPasswordPrefix = "sha256bcrypt:"

// allowedSymbols is the set of special characters accepted by the password policy,
// matching the frontend regex: [!@#$%^&*]
const allowedSymbols = "!@#$%^&*"

const (
	// MinPasswordLength is the minimum password length
	// Security audit recommends 12+ characters with complexity.
	MinPasswordLength = 12
	// BcryptCost is the cost for bcrypt password hashing.
	BcryptCost = 12
	// PINBcryptCost is the cost for bcrypt PIN hashing. PINs are already
	// peppered with HMAC-SHA256 (a 256-bit server secret), which makes the
	// effective keyspace 2^256 regardless of bcrypt cost — offline dictionary
	// attacks against the 10^6 PIN space are infeasible without the pepper.
	// A lower cost (~6ms) significantly reduces the CPU surface for DoS via
	// concurrent wrong-PIN submissions compared to cost 12 (~250ms).
	PINBcryptCost = 8
)

// prehashPassword returns SHA-256(password) as a byte slice. Pre-hashing
// eliminates bcrypt's silent 72-byte truncation: the bcrypt input is always
// exactly 32 bytes regardless of the original password length.
func prehashPassword(password string) []byte {
	h := sha256.Sum256([]byte(password))
	return h[:]
}

// HashPassword hashes a plain text password using SHA-256 pre-hashing + bcrypt.
// The resulting string is prefixed with "sha256bcrypt:" to distinguish it from
// legacy plain-bcrypt hashes still in the database.
func HashPassword(password string) (string, error) {
	hashedBytes, err := bcrypt.GenerateFromPassword(prehashPassword(password), BcryptCost)
	if err != nil {
		return "", err
	}
	return preHashedPasswordPrefix + string(hashedBytes), nil
}

// ComparePassword compares a stored hash against a plain text password.
// It handles both the current "sha256bcrypt:" prefixed format and the legacy
// plain-bcrypt format so that existing users are not locked out.
func ComparePassword(hashedPassword, password string) error {
	if strings.HasPrefix(hashedPassword, preHashedPasswordPrefix) {
		stripped := strings.TrimPrefix(hashedPassword, preHashedPasswordPrefix)
		return bcrypt.CompareHashAndPassword([]byte(stripped), prehashPassword(password))
	}
	// Legacy hash: compare directly (no pre-hashing was applied).
	return bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
}

// IsPreHashedPassword reports whether the stored hash was produced with the
// SHA-256 pre-hashing scheme. Callers can use this to silently upgrade legacy
// hashes after a successful comparison.
func IsPreHashedPassword(hash string) bool {
	return strings.HasPrefix(hash, preHashedPasswordPrefix)
}

// ValidatePasswordStrength checks if password meets minimum requirements:
// at least 12 characters, one uppercase, one lowercase, one digit, and one
// special character from [!@#$%^&*]. This matches the frontend regex:
// /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{12,}$/
func ValidatePasswordStrength(password string) bool {
	if len(password) < MinPasswordLength {
		return false
	}

	var hasUpper, hasLower, hasDigit, hasSymbol bool
	for _, r := range password {
		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		case strings.ContainsRune(allowedSymbols, r):
			hasSymbol = true
		}
	}

	return hasUpper && hasLower && hasDigit && hasSymbol
}

// GenerateStrongPassword returns a random password that satisfies the
// ValidatePasswordStrength requirements. It is intended for internally
// generated passwords for accounts created via social login.
func GenerateStrongPassword(length int) (string, error) {
	if length < MinPasswordLength {
		length = MinPasswordLength
	}

	upper := "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	lower := "abcdefghijklmnopqrstuvwxyz"
	digits := "0123456789"
	symbols := allowedSymbols
	all := upper + lower + digits + symbols

	b := make([]byte, length)

	// Ensure at least one from each required class.
	classes := []string{upper, lower, digits, symbols}
	for i, class := range classes {
		idx, err := randInt(len(class))
		if err != nil {
			return "", err
		}
		b[i] = class[idx]
	}

	// Fill the rest.
	for i := len(classes); i < length; i++ {
		idx, err := randInt(len(all))
		if err != nil {
			return "", err
		}
		b[i] = all[idx]
	}

	// Shuffle using crypto/rand Fisher–Yates.
	for i := len(b) - 1; i > 0; i-- {
		j, err := randInt(i + 1)
		if err != nil {
			return "", err
		}
		b[i], b[j] = b[j], b[i]
	}

	return string(b), nil
}

func randInt(max int) (int, error) {
	if max <= 0 {
		return 0, nil
	}
	var b [1]byte
	for {
		if _, err := rand.Read(b[:]); err != nil {
			return 0, err
		}
		if int(b[0]) < 256-(256%max) {
			return int(b[0]) % max, nil
		}
	}
}
