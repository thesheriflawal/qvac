package utils

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// jwtIssuer and jwtAudience are set once at startup via InitJWT and are
// embedded in every token and validated on every parse.
var (
	jwtIssuer   string
	jwtAudience string
)

// InitJWT registers the expected issuer and audience for JWT generation and
// validation. Must be called once at startup before any token is issued or
// validated. If either value is empty the corresponding claim is omitted /
// not validated (e.g. during local development without the env vars set).
func InitJWT(issuer, audience string) {
	jwtIssuer = issuer
	jwtAudience = audience
}

// JWTClaims represents the claims in a JWT token
type JWTClaims struct {
	UserID     uuid.UUID `json:"user_id"`
	Email      string    `json:"email"`
	Role       string    `json:"role"`
	TokenType  string    `json:"token_type,omitempty"` // "access" or "refresh"
	SessionID  string    `json:"session_id,omitempty"`
	DeviceType string    `json:"device_type,omitempty"`
	jwt.RegisteredClaims
}

// GenerateToken generates a new JWT token for a user
func GenerateToken(userID uuid.UUID, email, role, secret string, expiration time.Duration, opts ...TokenOption) (string, error) {
	rc := jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiration)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		NotBefore: jwt.NewNumericDate(time.Now()),
	}
	if jwtIssuer != "" {
		rc.Issuer = jwtIssuer
	}
	if jwtAudience != "" {
		rc.Audience = jwt.ClaimStrings{jwtAudience}
	}
	claims := JWTClaims{
		UserID:           userID,
		Email:            email,
		Role:             role,
		RegisteredClaims: rc,
	}

	for _, opt := range opts {
		opt(&claims)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// TokenOption is a functional option for GenerateToken.
type TokenOption func(*JWTClaims)

// WithSession sets session ID and device type on the token claims.
func WithSession(sessionID, deviceType string) TokenOption {
	return func(c *JWTClaims) {
		c.SessionID = sessionID
		c.DeviceType = deviceType
	}
}

// WithTokenType sets the token_type claim ("access", "refresh", or "pre_auth").
func WithTokenType(tokenType string) TokenOption {
	return func(c *JWTClaims) {
		c.TokenType = tokenType
	}
}

// WithDeviceType sets the device_type claim without associating a session ID.
// Used for pre_auth tokens where the session hasn't been created yet.
func WithDeviceType(deviceType string) TokenOption {
	return func(c *JWTClaims) {
		c.DeviceType = deviceType
	}
}

// WithJTI sets the JWT ID (jti) claim to the given value.
// Used for pre_auth tokens to enable single-use enforcement via Redis.
func WithJTI(jti string) TokenOption {
	return func(c *JWTClaims) {
		c.ID = jti
	}
}

// GenerateSessionID returns a cryptographically random 16-byte hex string.
func GenerateSessionID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate session ID: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// ValidateToken validates a JWT token and returns the claims
func ValidateToken(tokenString, secret string) (*JWTClaims, error) {
	parseOpts := []jwt.ParserOption{jwt.WithExpirationRequired()}
	if jwtIssuer != "" {
		parseOpts = append(parseOpts, jwt.WithIssuer(jwtIssuer))
	}
	if jwtAudience != "" {
		parseOpts = append(parseOpts, jwt.WithAudience(jwtAudience))
	}

	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	}, parseOpts...)

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// RefreshToken generates a new access token using a refresh token.
func RefreshToken(refreshTokenString, refreshSecret, accessSecret string, accessExpiration time.Duration) (string, error) {
	claims, err := ValidateToken(refreshTokenString, refreshSecret)
	if err != nil {
		return "", err
	}

	if claims.TokenType != "refresh" {
		return "", errors.New("invalid token type: refresh token required")
	}

	// Carry over session info so the new access token belongs to the same session.
	var opts []TokenOption
	if claims.SessionID != "" {
		opts = append(opts, WithSession(claims.SessionID, claims.DeviceType))
	}
	opts = append(opts, WithTokenType("access"))

	return GenerateToken(claims.UserID, claims.Email, claims.Role, accessSecret, accessExpiration, opts...)
}

// ExtractTokenFromHeader extracts the token from Authorization header
func ExtractTokenFromHeader(authHeader string) (string, error) {
	if authHeader == "" {
		return "", errors.New("authorization header is required")
	}

	// Expected format: "Bearer <token>"
	const bearerPrefix = "Bearer "
	if len(authHeader) < len(bearerPrefix) {
		return "", errors.New("invalid authorization header format")
	}

	if authHeader[:len(bearerPrefix)] != bearerPrefix {
		return "", errors.New("authorization header must start with 'Bearer '")
	}

	return authHeader[len(bearerPrefix):], nil
}
