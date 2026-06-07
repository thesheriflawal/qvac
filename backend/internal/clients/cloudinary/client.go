package cloudinary

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/internal/ratelimit"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"go.uber.org/zap"
)

// Client is the Cloudinary API client for image uploads
type Client struct {
	cloudName  string
	apiKey     string
	apiSecret  string
	httpClient *http.Client
}

// NewClient creates a new Cloudinary client
func NewClient(cfg config.CloudinaryConfig) *Client {
	return &Client{
		cloudName: cfg.CloudName,
		apiKey:    cfg.APIKey,
		apiSecret: cfg.APISecret,
		httpClient: &http.Client{
			Timeout:   60 * time.Second,
			Transport: ratelimit.NewTransport(ratelimit.NewLimiter(5, 5)), // 5 req/s, burst 5
		},
	}
}

// UploadResult represents the response from Cloudinary upload
// Note: Cloudinary may add more fields in the future, so we only parse what we need
type UploadResult struct {
	SecureURL  string `json:"secure_url"`
	PublicID   string `json:"public_id"`
	Format     string `json:"format"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	Bytes      int    `json:"bytes"`
	ResourceType string `json:"resource_type"`
}

// UploadImage uploads an image to Cloudinary and returns the result
func (c *Client) UploadImage(ctx context.Context, file io.Reader, filename string, folder string) (*UploadResult, error) {
	uploadURL := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", c.cloudName)

	// Create multipart form
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Add the file
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, fmt.Errorf("create form file: %w", err)
	}

	if _, err := io.Copy(part, file); err != nil {
		return nil, fmt.Errorf("copy file data: %w", err)
	}

	// Add required fields for signed upload
	timestamp := fmt.Sprintf("%d", time.Now().Unix())

	if err := writer.WriteField("api_key", c.apiKey); err != nil {
		return nil, fmt.Errorf("write api_key: %w", err)
	}

	if err := writer.WriteField("timestamp", timestamp); err != nil {
		return nil, fmt.Errorf("write timestamp: %w", err)
	}

	// Build signature string and generate signature
	signatureStr := fmt.Sprintf("folder=%s&timestamp=%s%s", folder, timestamp, c.apiSecret)
	signature := sha1Hash(signatureStr)

	if err := writer.WriteField("signature", signature); err != nil {
		return nil, fmt.Errorf("write signature: %w", err)
	}

	if folder != "" {
		if err := writer.WriteField("folder", folder); err != nil {
			return nil, fmt.Errorf("write folder: %w", err)
		}
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("close writer: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, &buf)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB limit
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		logger.FromCtx(ctx).Error("Cloudinary upload failed",
			zap.Int("status", resp.StatusCode),
			zap.String("filename", filename),
			zap.String("folder", folder),
		)
		return nil, fmt.Errorf("cloudinary API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	// Parse response - only extract fields we need (forward compatible)
	var result UploadResult
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	if result.SecureURL == "" {
		return nil, fmt.Errorf("cloudinary did not return a secure_url")
	}

	logger.FromCtx(ctx).Info("Cloudinary upload success",
		zap.String("public_id", result.PublicID),
		zap.String("format", result.Format),
		zap.Int("bytes", result.Bytes),
		zap.String("folder", folder),
	)
	return &result, nil
}

// UploadImageFromBytes uploads an image from bytes
func (c *Client) UploadImageFromBytes(ctx context.Context, data []byte, filename string, folder string) (*UploadResult, error) {
	return c.UploadImage(ctx, bytes.NewReader(data), filename, folder)
}

// sha1Hash computes SHA1 hash for Cloudinary signature
func sha1Hash(s string) string {
	h := sha1.New()
	h.Write([]byte(s))
	return fmt.Sprintf("%x", h.Sum(nil))
}
