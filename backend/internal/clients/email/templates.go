package email

import (
	"embed"
	"strings"
)

//go:embed templates/*.html
var templateFS embed.FS

func loadTemplate(name string) string {
	b, err := templateFS.ReadFile("templates/" + name)
	if err != nil {
		return ""
	}
	return string(b)
}

func render(tmpl string, vars map[string]string) string {
	for k, v := range vars {
		tmpl = strings.ReplaceAll(tmpl, "{{"+k+"}}", v)
	}
	return tmpl
}

// WelcomeEmailHTML returns the welcome email after account creation.
func WelcomeEmailHTML() string {
	return loadTemplate("welcome.html")
}

// EmailVerificationHTML returns the email verification OTP email.
func EmailVerificationHTML(name, otp string) string {
	return render(loadTemplate("email-verification.html"), map[string]string{
		"name": name,
		"otp":  otp,
	})
}

// LoginOTPEmailHTML returns the login/2FA OTP email.
func LoginOTPEmailHTML(name, otp, date, ipAddress string) string {
	return render(loadTemplate("login-otp.html"), map[string]string{
		"name":       name,
		"otp":        otp,
		"date":       date,
		"ip_address": ipAddress,
	})
}

// PasswordResetEmailHTML returns the password reset OTP email.
func PasswordResetEmailHTML(name, otp string) string {
	return render(loadTemplate("password-reset.html"), map[string]string{
		"name": name,
		"otp":  otp,
	})
}

// CryptoDepositEmailHTML returns the crypto deposit confirmation email.
func CryptoDepositEmailHTML(name, amount, currency, network, address, txHash, date string) string {
	return render(loadTemplate("crypto-deposit.html"), map[string]string{
		"name":     name,
		"amount":   amount,
		"currency": currency,
		"network":  network,
		"address":  address,
		"tx_hash":  txHash,
		"date":     date,
	})
}

// CryptoWithdrawalEmailHTML returns the crypto withdrawal confirmation email.
func CryptoWithdrawalEmailHTML(name, amount, currency, network, address, txHash, fee, reference, date string) string {
	return render(loadTemplate("crypto-withdrawal.html"), map[string]string{
		"name":      name,
		"amount":    amount,
		"currency":  currency,
		"network":   network,
		"address":   address,
		"tx_hash":   txHash,
		"fee":       fee,
		"reference": reference,
		"date":      date,
	})
}

// FiatDepositEmailHTML returns the fiat deposit confirmation email.
func FiatDepositEmailHTML(name, amount, reference, date string) string {
	return render(loadTemplate("fiat-deposit.html"), map[string]string{
		"name":      name,
		"amount":    amount,
		"reference": reference,
		"date":      date,
	})
}

// FiatWithdrawalEmailHTML returns the fiat withdrawal confirmation email.
func FiatWithdrawalEmailHTML(name, amount, fee, reference, accountName, accountNumber, bankName, date string) string {
	return render(loadTemplate("fiat-withdrawal.html"), map[string]string{
		"name":           name,
		"amount":         amount,
		"fee":            fee,
		"reference":      reference,
		"account_name":   accountName,
		"account_number": accountNumber,
		"bank_name":      bankName,
		"date":           date,
	})
}

// InternalTransferSentEmailHTML returns the email for an outgoing internal transfer.
func InternalTransferSentEmailHTML(name, amount, currency, receiverName, receiverEmail, reference, date string) string {
	return render(loadTemplate("internal-transfer-sent.html"), map[string]string{
		"name":           name,
		"amount":         amount,
		"currency":       currency,
		"receiver_name":  receiverName,
		"receiver_email": receiverEmail,
		"reference":      reference,
		"date":           date,
	})
}

// InternalTransferReceivedEmailHTML returns the email for an incoming internal transfer.
func InternalTransferReceivedEmailHTML(name, amount, currency, senderName, senderEmail, reference, date string) string {
	return render(loadTemplate("internal-transfer-received.html"), map[string]string{
		"name":         name,
		"amount":       amount,
		"currency":     currency,
		"sender_name":  senderName,
		"sender_email": senderEmail,
		"reference":    reference,
		"date":         date,
	})
}

// P2PTradeBuyEmailHTML returns the email for a completed P2P buy trade.
func P2PTradeBuyEmailHTML(name, quantity, currency, price, fiatAmount, counterparty, reference, date string) string {
	return render(loadTemplate("p2p-trade-buy.html"), map[string]string{
		"name":         name,
		"quantity":     quantity,
		"currency":     currency,
		"price":        price,
		"fiat_amount":  fiatAmount,
		"counterparty": counterparty,
		"reference":    reference,
		"date":         date,
	})
}

// P2PTradeSellEmailHTML returns the email for a completed P2P sell trade.
func P2PTradeSellEmailHTML(name, quantity, currency, price, fiatAmount, counterparty, reference, date string) string {
	return render(loadTemplate("p2p-trade-sell.html"), map[string]string{
		"name":         name,
		"quantity":     quantity,
		"currency":     currency,
		"price":        price,
		"fiat_amount":  fiatAmount,
		"counterparty": counterparty,
		"reference":    reference,
		"date":         date,
	})
}
