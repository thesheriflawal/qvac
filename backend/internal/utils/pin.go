package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// pinPepper is a server-side secret mixed into every PIN hash to prevent
// offline dictionary attacks against the 10^6 PIN keyspace. Set at startup
// via InitPINPepper; never written to the database.
var pinPepper string

// pepperedPINPrefix distinguishes peppered hashes from legacy plain-bcrypt
// hashes that were stored before this protection was introduced.
const pepperedPINPrefix = "peppered:"

// InitPINPepper registers the server-side pepper. Must be called once at
// startup (before any PIN hashing or verification) with the value of the
// PIN_PEPPER environment variable.
func InitPINPepper(pepper string) {
	pinPepper = pepper
}

// pepperPIN returns HMAC-SHA256(pin, pinPepper) as a lowercase hex string.
// Mixing a 256-bit server secret into the input expands the effective keyspace
// from 10^6 to 2^256, making offline brute-force infeasible without the pepper.
//
// Panics if InitPINPepper has not been called with a non-empty value. This
// fail-closed design ensures a misconfigured deployment crashes at first PIN
// operation rather than silently storing unprotected hashes.
func pepperPIN(pin string) string {
	if pinPepper == "" {
		panic("PIN pepper not initialised — call utils.InitPINPepper with PIN_PEPPER at startup")
	}
	mac := hmac.New(sha256.New, []byte(pinPepper))
	mac.Write([]byte(pin))
	return hex.EncodeToString(mac.Sum(nil))
}

// HashPIN peppers a 6-digit PIN with HMAC-SHA256, then bcrypts the result.
// The stored string is prefixed with "peppered:" so it can be distinguished
// from legacy plain-bcrypt hashes (see VerifyPIN).
func HashPIN(pin string) (string, error) {
	if strings.TrimSpace(pin) == "" {
		return "", errors.New("pin must not be empty")
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(pepperPIN(pin)), PINBcryptCost)
	if err != nil {
		return "", err
	}
	return pepperedPINPrefix + string(hashed), nil
}

// VerifyPIN checks a plain PIN against a stored hash. It handles both the
// current peppered format ("peppered:<bcrypt>") and the legacy plain-bcrypt
// format so users are not locked out before their hash is migrated.
func VerifyPIN(storedHash, pin string) error {
	if strings.TrimSpace(pin) == "" {
		return errors.New("pin must not be empty")
	}
	if strings.HasPrefix(storedHash, pepperedPINPrefix) {
		bcryptHash := strings.TrimPrefix(storedHash, pepperedPINPrefix)
		if err := bcrypt.CompareHashAndPassword([]byte(bcryptHash), []byte(pepperPIN(pin))); err != nil {
			return errors.New("invalid PIN")
		}
		return nil
	}
	// Legacy path: plain bcrypt (no pepper). Verify as-is; callers should
	// upgrade the stored hash with HashPIN on the next successful auth.
	if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(pin)); err != nil {
		return errors.New("invalid PIN")
	}
	return nil
}

// IsPepperedPINHash reports whether a stored hash was created by HashPIN
// (i.e., already carries the pepper). Used to trigger silent hash upgrades.
func IsPepperedPINHash(hash string) bool {
	return strings.HasPrefix(hash, pepperedPINPrefix)
}
