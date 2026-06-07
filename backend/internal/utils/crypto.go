package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
)

// KYCBlindIndex computes an HMAC-SHA256 of value using key and returns the
// result as a lowercase hex string. Use a dedicated, high-entropy secret key
// (KYC_BLIND_INDEX_KEY) so the index cannot be brute-forced even if the
// database is compromised.
func KYCBlindIndex(key, value string) string {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

// EncryptAES encrypts plaintext using AES-GCM and the provided 32-byte hex key.
// It returns a base64 encoded string containing the nonce and ciphertext.
func EncryptAES(plaintext, key string) (string, error) {
	if len(plaintext) == 0 {
		return "", nil // Or return an error depending on requirements
	}
	

	keyBytes := []byte(key)
	if len(keyBytes) != 32 {
		return "", errors.New("encryption key must be exactly 32 bytes")
	}

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptAES decrypts a base64 encoded string containing nonce and ciphertext
// using AES-GCM and the provided 32-byte key.
func DecryptAES(cryptoText, key string) (string, error) {
	if len(cryptoText) == 0 {
		return "", nil // Or return an error depending on requirements
	}

	ciphertext, err := base64.StdEncoding.DecodeString(cryptoText)
	if err != nil {
		return "", err
	}

	keyBytes := []byte(key)
	if len(keyBytes) != 32 {
		return "", errors.New("decryption key must be exactly 32 bytes")
	}

	block, err := aes.NewCipher(keyBytes)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintextBytes, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintextBytes), nil
}
