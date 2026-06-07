package email

import (
	"errors"
	"fmt"
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/resend/resend-go/v3"
	"go.uber.org/zap"
)

type ResendSender struct {
	client *resend.Client
	from   string
}

// noopSender is returned when no API key is configured.
type noopSender struct{}

func (n *noopSender) SendOTP(_, _, _ string) error { return nil }

func NewResendSender(cfg config.ResendConfig) (Sender, error) {
	if strings.TrimSpace(cfg.APIKey) == "" {
		logger.Info("RESEND_API_KEY not set — email sending disabled (no-op)")
		return &noopSender{}, nil
	}
	if strings.TrimSpace(cfg.From) == "" {
		return nil, errors.New("RESEND_FROM is required")
	}

	return &ResendSender{
		client: resend.NewClient(cfg.APIKey),
		from:   cfg.From,
	}, nil
}

func (s *ResendSender) SendOTP(toEmail, subject, html string) error {
	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{toEmail},
		Subject: subject,
		Html:    html,
	}

	sent, err := s.client.Emails.Send(params)
	if err != nil {
		return err
	}

	logger.Info("Email sent", zap.String("provider", "resend"), zap.String("id", sent.Id), zap.String("to", toEmail))
	return nil
}

// AlreadyRegisteredEmailHTML returns an HTML email body for when a registration
// OTP is requested for an email address that already has an account. It informs
// the recipient without exposing any account details to the API caller.
func AlreadyRegisteredEmailHTML(appName string) string {
	return fmt.Sprintf(
		"<div style=\"font-family:Arial,sans-serif\">"+
			"<h2>%s</h2>"+
			"<p>Someone tried to register a new account using your email address.</p>"+
			"<p>If this was you, please log in to your existing account instead.</p>"+
			"<p>If you did not make this request, you can safely ignore this email.</p>"+
			"</div>",
		appName,
	)
}

// AccountDeletionEmailHTML returns an HTML confirmation email for account deletion.
// It is sent to the user's address before PII is anonymised, so they have a record
// that the request was received and what happens to their data.
func AccountDeletionEmailHTML(appName, retentionNote string) string {
	return fmt.Sprintf(
		"<div style=\"font-family:Arial,sans-serif\">"+
			"<h2>%s – Account deletion confirmation</h2>"+
			"<p>We received a request to permanently delete your account and associated personal data.</p>"+
			"<p>Your account has been deactivated immediately. Personal information (name, email address, "+
			"linked bank accounts, and crypto addresses) has been removed from our systems.</p>"+
			"<p><strong>Data retained for legal and financial compliance:</strong><br>%s</p>"+
			"<p>If you did not make this request, please contact our support team immediately.</p>"+
			"</div>",
		appName,
		retentionNote,
	)
}
