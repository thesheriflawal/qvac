// Package telegram provides a minimal Telegram Bot API client.
// It uses only the standard library — no extra dependencies needed.
package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const apiBase = "https://api.telegram.org/bot"

// Client is a Telegram Bot API HTTP client.
type Client struct {
	token      string
	httpClient *http.Client
}

// NewClient creates a Telegram Bot API client. token is the bot token from
// @BotFather (e.g. "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ").
func NewClient(token string) *Client {
	return &Client{
		token: token,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// IsConfigured returns true if a bot token has been set.
func (c *Client) IsConfigured() bool {
	return strings.TrimSpace(c.token) != ""
}

// ── Request/response types ────────────────────────────────────────────────

type sendMessageReq struct {
	ChatID    int64  `json:"chat_id"`
	Text      string `json:"text"`
	ParseMode string `json:"parse_mode,omitempty"` // "Markdown" | "HTML"
}

type apiResponse struct {
	OK          bool            `json:"ok"`
	Result      json.RawMessage `json:"result"`
	Description string          `json:"description"`
}

// Update represents an incoming Telegram update (message, callback, etc.)
type Update struct {
	UpdateID int64    `json:"update_id"`
	Message  *Message `json:"message,omitempty"`
}

// Message is a Telegram message.
type Message struct {
	MessageID int64  `json:"message_id"`
	Chat      Chat   `json:"chat"`
	From      *User  `json:"from,omitempty"`
	Text      string `json:"text"`
	Date      int64  `json:"date"`
}

// Chat is a Telegram chat (group, channel, or private).
type Chat struct {
	ID       int64  `json:"id"`
	Type     string `json:"type"` // "private", "group", "supergroup", "channel"
	Username string `json:"username,omitempty"`
	Title    string `json:"title,omitempty"`
}

// User is a Telegram user.
type User struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	Username  string `json:"username,omitempty"`
}

// GetUpdatesResponse holds the result of getUpdates.
type GetUpdatesResponse struct {
	Updates []Update
}

// ── API Methods ──────────────────────────────────────────────────────────

// SendMessage sends a plain-text message to the given chat ID.
func (c *Client) SendMessage(ctx context.Context, chatID int64, text string) error {
	return c.sendMessage(ctx, chatID, text, "")
}

// SendMarkdown sends a Markdown-formatted message.
func (c *Client) SendMarkdown(ctx context.Context, chatID int64, text string) error {
	return c.sendMessage(ctx, chatID, text, "Markdown")
}

func (c *Client) sendMessage(ctx context.Context, chatID int64, text, parseMode string) error {
	if !c.IsConfigured() {
		return nil // silently skip if bot is not configured
	}
	body, err := json.Marshal(sendMessageReq{
		ChatID:    chatID,
		Text:      text,
		ParseMode: parseMode,
	})
	if err != nil {
		return err
	}
	return c.post(ctx, "sendMessage", body)
}

// GetUpdates fetches updates starting from offset (long-polling, timeout=0).
func (c *Client) GetUpdates(ctx context.Context, offset int64) ([]Update, error) {
	if !c.IsConfigured() {
		return nil, nil
	}
	body, _ := json.Marshal(map[string]interface{}{
		"offset":  offset,
		"timeout": 0,
		"limit":   100,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url("getUpdates"), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var apiResp struct {
		OK     bool     `json:"ok"`
		Result []Update `json:"result"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&apiResp); err != nil {
		return nil, err
	}
	return apiResp.Result, nil
}

// SetWebhook registers a webhook URL with Telegram.
func (c *Client) SetWebhook(ctx context.Context, webhookURL string) error {
	body, _ := json.Marshal(map[string]string{"url": webhookURL})
	return c.post(ctx, "setWebhook", body)
}

// GetMe returns basic information about the bot.
func (c *Client) GetMe(ctx context.Context) (*User, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url("getMe"), nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var apiResp struct {
		OK     bool  `json:"ok"`
		Result *User `json:"result"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&apiResp); err != nil {
		return nil, err
	}
	return apiResp.Result, nil
}

// post is the shared POST helper.
func (c *Client) post(ctx context.Context, method string, body []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url(method), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("telegram %s: %w", method, err)
	}
	defer resp.Body.Close()

	var apiResp apiResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&apiResp); err != nil {
		return fmt.Errorf("telegram %s: decode error: %w", method, err)
	}
	if !apiResp.OK {
		return fmt.Errorf("telegram %s: %s", method, apiResp.Description)
	}
	return nil
}

func (c *Client) url(method string) string {
	return apiBase + c.token + "/" + method
}
