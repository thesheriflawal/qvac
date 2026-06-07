package utils

import (
	"crypto/rand"
	"math/big"
	"strings"
)

const (
	referralCodeLength  = 6
	referralCodeCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
)

// GenerateReferralCode produces a 6-character alphanumeric referral code.
func GenerateReferralCode() (string, error) {
	max := big.NewInt(int64(len(referralCodeCharset)))
	var sb strings.Builder

	for i := 0; i < referralCodeLength; i++ {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		sb.WriteByte(referralCodeCharset[n.Int64()])
	}

	return sb.String(), nil
}
