package email

// Sender abstracts email sending so services don't depend on a specific provider.
type Sender interface {
	SendOTP(toEmail, subject, html string) error
}
