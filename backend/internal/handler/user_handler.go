package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/internal/middleware"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// UserHandler handles user requests
type UserHandler struct {
	userService   service.UserService
	walletService service.WalletService
}

// NewUserHandler creates a new user handler
func NewUserHandler(userService service.UserService, walletService service.WalletService) *UserHandler {
	return &UserHandler{
		userService:   userService,
		walletService: walletService,
	}
}

// UpdateProfileRequest represents the update profile request body
type UpdateProfileRequest struct {
}

// ChangePasswordRequest represents the change password request body
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required"`
	// Enforce strong password policy consistent with registration and reset flows.
	NewPassword string `json:"new_password" validate:"required,min=12"`
}

// SetupPINRequest represents the request body for setting up a transaction PIN.
type SetupPINRequest struct {
	Pin        string `json:"pin" validate:"required,len=6"`
	ConfirmPin string `json:"confirm_pin" validate:"required,eqfield=Pin"`
}

// ChangePINRequest represents the request body for changing an existing PIN.
type ChangePINRequest struct {
	OldPin        string `json:"old_pin" validate:"required,len=6"`
	NewPin        string `json:"new_pin" validate:"required,len=6"`
	ConfirmNewPin string `json:"confirm_new_pin" validate:"required,eqfield=NewPin"`
}

// InternalTransferRequest represents the internal transfer request body.
// Currency is now provided by currency ID (referencing the currencies table).
type InternalTransferRequest struct {
	ReceiverUID   string    `json:"receiver_uid" validate:"omitempty,len=14"`
	ReceiverEmail string    `json:"receiver_email" validate:"omitempty,email"`
	CurrencyID    uuid.UUID `json:"currency_id" validate:"required"`
	Amount        string    `json:"amount" validate:"required"`
	// 6-digit transaction PIN.
	Pin string `json:"pin" validate:"required,len=6"`
	// 6-digit Google Authenticator (TOTP) code. Required only when 2FA is enabled.
	AuthCode string `json:"auth_code" validate:"omitempty,len=6"`
}

// CryptoWithdrawRequest represents the crypto withdrawal request body.
type CryptoWithdrawRequest struct {
	Chain    string `json:"chain" validate:"required"`
	Currency string `json:"currency" validate:"required"`
	Address  string `json:"address" validate:"required"`
	Amount   string `json:"amount" validate:"required"`
	Note     string `json:"note" validate:"omitempty,max=255"`

	// 6-digit transaction PIN.
	Pin string `json:"pin" validate:"required,len=6"`
	// 6-digit Google Authenticator (TOTP) code. Required only when 2FA is enabled.
	AuthCode string `json:"auth_code" validate:"omitempty,len=6"`
}

// FiatBankLookupRequest represents the request body for resolving a bank account name.
type FiatBankLookupRequest struct {
	BankCode      string `json:"bank_code" validate:"required"`
	AccountNumber string `json:"account_number" validate:"required"`
}

// FiatWithdrawRequest represents the fiat withdrawal request body.
type FiatWithdrawRequest struct {
	BankCode      string `json:"bank_code" validate:"required"`
	BankName      string `json:"bank_name" validate:"required"`
	AccountNumber string `json:"account_number" validate:"required"`
	AccountName   string `json:"account_name" validate:"required"`
	Amount        string `json:"amount" validate:"required"`
	Narration     string `json:"narration" validate:"omitempty,max=255"`

	// 6-digit transaction PIN.
	Pin string `json:"pin" validate:"required,len=6"`
	// 6-digit Google Authenticator (TOTP) code. Required only when 2FA is enabled.
	AuthCode string `json:"auth_code" validate:"omitempty,len=6"`
}

// TwoFASetupResponse represents the response for initiating 2FA setup.
type TwoFASetupResponse struct {
	Secret     string `json:"secret"`
	OtpauthURL string `json:"otpauth_url"`
	Enabled    bool   `json:"enabled"`
}

// EnableTwoFARequest represents the request body to enable 2FA.
type EnableTwoFARequest struct {
	Code string `json:"code" validate:"required,len=6"`
}

// DisableTwoFARequest represents the request body to disable 2FA.
type DisableTwoFARequest struct {
	// 6-digit transaction PIN.
	Pin string `json:"pin" validate:"required,len=6"`
	// 6-digit Google Authenticator (TOTP) code.
	Code string `json:"code" validate:"required,len=6"`
}

// WalletAddressResponse represents a user's wallet address for a chain
type WalletAddressResponse struct {
	Chain   string `json:"chain"`
	Address string `json:"address"`
	Created bool   `json:"created"`
}

// GetProfile retrieves the current user's profile
// @Summary Get current user profile
// @Description Retrieve the authenticated user's profile information
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} utils.Response{data=models.UserResponse} "Profile retrieved successfully"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 404 {object} utils.Response "User not found"
// @Router /users/me [get]
func (h *UserHandler) GetProfile(c *gin.Context) {
	// Get user from context
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	// Get user by ID
	user, err := h.userService.GetByID(claims.UserID)
	if err != nil {
		utils.NotFoundResponse(c, utils.SanitizeServiceError(err))
		return
	}

	c.Header("Cache-Control", "no-store")
	utils.SuccessResponse(c, http.StatusOK, "Profile retrieved successfully", user.ToResponse())
}

// UpdateProfile updates the current user's profile
// @Summary Update current user profile
// @Description Update the authenticated user's name or email
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body UpdateProfileRequest true "Profile update details"
// @Success 200 {object} utils.Response{data=models.UserResponse} "Profile updated successfully"
// @Failure 400 {object} utils.Response "Invalid request or email already exists"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /users/me [put]
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	// Get user from context
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req UpdateProfileRequest

	// Bind and validate request
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	// Update user
	user, err := h.userService.Update(claims.UserID)
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Profile updated successfully", user.ToResponse())
}

// RequestEmailChangeOTPRequest holds the target email address for an email-change request.
type RequestEmailChangeOTPRequest struct {
	NewEmail string `json:"new_email" binding:"required" validate:"required,email"`
	Password string `json:"password" binding:"required" validate:"required"`
}

// ConfirmEmailChangeRequest holds the OTP that was sent to the new email address.
type ConfirmEmailChangeRequest struct {
	OTP string `json:"otp" binding:"required" validate:"required,len=6"`
}

// RequestEmailChangeOTP sends a verification OTP to the requested new email address.
// @Summary Request email change OTP
// @Description Send a 6-digit OTP to the new email address. Call /me/email-change/confirm with the code to commit the change.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body RequestEmailChangeOTPRequest true "New email address"
// @Success 200 {object} utils.Response "OTP sent to new email address"
// @Failure 400 {object} utils.Response "Validation error or email already in use"
// @Failure 401 {object} utils.Response "Authentication required"
// @Router /users/me/email-change/request [post]
func (h *UserHandler) RequestEmailChangeOTP(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req RequestEmailChangeOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}
	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	// Re-authenticate: verify the caller's current password before allowing
	// an email change, which would otherwise enable account takeover from a
	// stolen session token.
	user, err := h.userService.GetByID(claims.UserID)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}
	if err := utils.ComparePassword(user.Password, req.Password); err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, "invalid password", nil)
		return
	}

	if err := h.userService.RequestEmailChangeOTP(claims.UserID, req.NewEmail); err != nil {
		// Log internally but always return a generic message to prevent
		// distinguishing between a taken and available email address.
		logger.Ctx(c).Warn("Email change OTP request failed",
			zap.String("user_id", claims.UserID.String()),
			zap.Error(err),
		)
	}

	utils.SuccessResponse(c, http.StatusOK, "If this email is available, a verification code has been sent to it", nil)
}

// ConfirmEmailChange verifies the OTP and commits the email address update.
// @Summary Confirm email change
// @Description Verify the OTP sent to the new email address and update the account email.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body ConfirmEmailChangeRequest true "OTP code"
// @Success 200 {object} utils.Response "Email updated successfully"
// @Failure 400 {object} utils.Response "Invalid or expired OTP"
// @Failure 401 {object} utils.Response "Authentication required"
// @Router /users/me/email-change/confirm [post]
func (h *UserHandler) ConfirmEmailChange(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req ConfirmEmailChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}
	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := h.userService.ConfirmEmailChange(claims.UserID, req.OTP); err != nil {
		if errors.Is(err, service.ErrOTPRateLimited) {
			utils.ErrorResponse(c, http.StatusTooManyRequests, "Too many invalid OTP attempts. Please request a new OTP.", nil)
			return
		}
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Email updated successfully", nil)
}

// ChangePassword changes the current user's password
// @Summary Change user password
// @Description Change the authenticated user's password
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body ChangePasswordRequest true "Password change details"
// @Success 200 {object} utils.Response "Password changed successfully"
// @Failure 400 {object} utils.Response "Invalid old password or validation error"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /users/me/change-password [post]
func (h *UserHandler) ChangePassword(c *gin.Context) {
	// Get user from context
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req ChangePasswordRequest

	// Bind and validate request
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	// Enforce password strength consistent with other flows (registration, reset).
	if !utils.ValidatePasswordStrength(req.NewPassword) {
		utils.ValidationErrorResponse(c, "password must be at least 12 characters and include uppercase, lowercase, digit, and a symbol from !@#$%^&*")
		return
	}

	// Change password
	if err := h.userService.ChangePassword(claims.UserID, req.OldPassword, req.NewPassword); err != nil {
		logger.Ctx(c).Warn("Password change failed",
			zap.String("user_id", claims.UserID.String()),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Password changed", zap.String("user_id", claims.UserID.String()))
	utils.SuccessResponse(c, http.StatusOK, "Password changed successfully", nil)
}

// DeleteMyAccountRequest requires the user's current password to confirm account deletion.
type DeleteMyAccountRequest struct {
	Password string `json:"password" binding:"required" validate:"required"`
}

// DeleteMyAccount deletes the currently authenticated user's account.
// @Summary Delete my account
// @Description Permanently deletes the authenticated user's account and all associated personal data in compliance with Google Play Store data deletion policy. A confirmation email is sent before deletion. Financial records (transactions, orders, wallet history) are retained for up to 7 years to satisfy anti-money-laundering and financial regulations. All active sessions are immediately revoked.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body DeleteMyAccountRequest true "Current password confirmation"
// @Success 200 {object} utils.Response "Account deleted successfully"
// @Failure 401 {object} utils.Response "Authentication required or invalid password"
// @Failure 400 {object} utils.Response "Unable to delete account"
// @Router /users/me [delete]
func (h *UserHandler) DeleteMyAccount(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req DeleteMyAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	// Re-authenticate: verify the caller's current password before permanent
	// account deletion to prevent account loss from a stolen session token.
	user, err := h.userService.GetByID(claims.UserID)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}
	if err := utils.ComparePassword(user.Password, req.Password); err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, "invalid password", nil)
		return
	}

	if err := h.userService.Delete(claims.UserID); err != nil {
		logger.Ctx(c).Error("Account deletion failed",
			zap.String("user_id", claims.UserID.String()),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Account deleted", zap.String("user_id", claims.UserID.String()))
	utils.SuccessResponse(c, http.StatusOK, "Account deleted successfully", gin.H{
		"deleted": []string{
			"profile (name, email address)",
			"linked bank accounts",
			"saved crypto addresses",
			"notification settings",
			"active sessions",
		},
		"retained": []string{
			"transaction history",
			"trade orders",
			"wallet activity",
		},
		"retention_reason": "Financial records are retained for up to 7 years to comply with anti-money-laundering and financial regulations.",
	})
}

// SetupPIN sets a 6-digit transaction PIN for the current user.
// @Summary Setup transaction PIN
// @Description Configure a 6-digit transaction PIN used together with Google Authenticator for high-risk actions.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body SetupPINRequest true "PIN setup details"
// @Success 200 {object} utils.Response "PIN setup successfully"
// @Failure 400 {object} utils.Response "Validation error or PIN already configured"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /users/me/pin/setup [post]
func (h *UserHandler) SetupPIN(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req SetupPINRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	db := database.GetDB()
	var sec models.UserSecurity
	if err := db.Where("user_id = ?", claims.UserID).First(&sec).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			sec = models.UserSecurity{UserID: claims.UserID}
		} else {
			utils.ServiceErrorResponse(c, err)
			return
		}
	} else {
		// If a PIN is already configured, force user to use the change endpoint.
		if sec.PinEnabled && strings.TrimSpace(sec.PinHash) != "" {
			logger.Ctx(c).Warn("PIN setup attempted but already configured", zap.String("user_id", claims.UserID.String()))
			utils.ErrorResponse(c, http.StatusBadRequest, "PIN already configured; use change endpoint", nil)
			return
		}
	}

	hashedPin, err := utils.HashPIN(req.Pin)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	sec.PinHash = hashedPin
	sec.PinEnabled = true
	sec.LastPinChange = time.Now().UTC()

	if sec.ID == uuid.Nil {
		if err := db.Create(&sec).Error; err != nil {
			utils.ServiceErrorResponse(c, err)
			return
		}
	} else {
		if err := db.Save(&sec).Error; err != nil {
			utils.ServiceErrorResponse(c, err)
			return
		}
	}

	logger.Ctx(c).Info("PIN setup successfully", zap.String("user_id", claims.UserID.String()))
	utils.SuccessResponse(c, http.StatusOK, "PIN setup successfully", nil)
}

// ChangePIN changes the existing 6-digit transaction PIN for the current user.
// @Summary Change transaction PIN
// @Description Change the 6-digit transaction PIN used together with Google Authenticator for high-risk actions.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body ChangePINRequest true "PIN change details"
// @Success 200 {object} utils.Response "PIN changed successfully"
// @Failure 400 {object} utils.Response "Validation error or invalid old PIN"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /users/me/pin/change [post]
func (h *UserHandler) ChangePIN(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req ChangePINRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	db := database.GetDB()
	var sec models.UserSecurity
	if err := db.Where("user_id = ?", claims.UserID).First(&sec).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.ErrorResponse(c, http.StatusBadRequest, "PIN not configured", nil)
			return
		}
		utils.ServiceErrorResponse(c, err)
		return
	}

	if !sec.PinEnabled || strings.TrimSpace(sec.PinHash) == "" {
		utils.ErrorResponse(c, http.StatusBadRequest, "PIN not configured", nil)
		return
	}

	if err := utils.VerifyPIN(sec.PinHash, req.OldPin); err != nil {
		logger.Ctx(c).Warn("PIN change failed: invalid old PIN", zap.String("user_id", claims.UserID.String()))
		utils.ErrorResponse(c, http.StatusBadRequest, "invalid old PIN", nil)
		return
	}

	hashedPin, err := utils.HashPIN(req.NewPin)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	sec.PinHash = hashedPin
	sec.PinEnabled = true
	sec.LastPinChange = time.Now().UTC()

	if err := db.Save(&sec).Error; err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	logger.Ctx(c).Info("PIN changed", zap.String("user_id", claims.UserID.String()))
	utils.SuccessResponse(c, http.StatusOK, "PIN changed successfully", nil)
}

// SetupTwoFA initializes TOTP
// @Summary Setup 2FA (Google Authenticator)
// @Description Generate a TOTP secret and otpauth URL for the authenticated user.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} utils.Response{data=TwoFASetupResponse} "2FA setup data generated"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /users/me/2fa/setup [post]
func (h *UserHandler) SetupTwoFA(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	// Load user to use email as account name in TOTP URI.
	user, err := h.userService.GetByID(claims.UserID)
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	key, err := utils.GenerateTOTPKey("Kynettic", user.Email)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	db := database.GetDB()
	var sec models.UserSecurity
	if err := db.Where("user_id = ?", user.ID).First(&sec).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			sec = models.UserSecurity{UserID: user.ID}
			sec.TwoFASecret = key.Secret()
			sec.TwoFAEnabled = false
			if err := db.Create(&sec).Error; err != nil {
				utils.ServiceErrorResponse(c, err)
				return
			}
		} else {
			utils.ServiceErrorResponse(c, err)
			return
		}
	} else {
		sec.TwoFASecret = key.Secret()
		sec.TwoFAEnabled = false
		if err := db.Save(&sec).Error; err != nil {
			utils.ServiceErrorResponse(c, err)
			return
		}
	}

	resp := TwoFASetupResponse{
		Secret:     key.Secret(),
		OtpauthURL: key.URL(),
		Enabled:    sec.TwoFAEnabled,
	}

	utils.SuccessResponse(c, http.StatusOK, "2FA setup data generated", resp)
}

// EnableTwoFA verifies the TOTP code and enables 2FA for the current user.
// @Summary Enable 2FA
// @Description Verify a 6-digit TOTP code and enable Google Authenticator for the authenticated user.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body EnableTwoFARequest true "2FA verification code"
// @Success 200 {object} utils.Response "2FA enabled successfully"
// @Failure 400 {object} utils.Response "Invalid code or 2FA not initialized"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /users/me/2fa/enable [post]
func (h *UserHandler) EnableTwoFA(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req EnableTwoFARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	db := database.GetDB()
	var sec models.UserSecurity
	if err := db.Where("user_id = ?", claims.UserID).First(&sec).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			utils.ErrorResponse(c, http.StatusBadRequest, "2FA not initialized", nil)
			return
		}
		utils.ServiceErrorResponse(c, err)
		return
	}
	if strings.TrimSpace(sec.TwoFASecret) == "" {
		utils.ErrorResponse(c, http.StatusBadRequest, "2FA not initialized", nil)
		return
	}

	if !utils.ValidateTOTPCode(sec.TwoFASecret, req.Code) {
		logger.Ctx(c).Warn("2FA enable failed: invalid code", zap.String("user_id", claims.UserID.String()))
		utils.ErrorResponse(c, http.StatusBadRequest, "invalid authenticator code", nil)
		return
	}
	if err := service.ConsumeTOTPCode(claims.UserID, req.Code); err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	sec.TwoFAEnabled = true
	if err := db.Save(&sec).Error; err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	logger.Ctx(c).Info("2FA enabled", zap.String("user_id", claims.UserID.String()))
	utils.SuccessResponse(c, http.StatusOK, "2FA enabled successfully", nil)
}

// DisableTwoFA disables Google Authenticator for the current user.
// @Summary Disable 2FA
// @Description Disable Google Authenticator for the authenticated user. Requires both transaction PIN and a valid TOTP code.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body DisableTwoFARequest true "PIN and TOTP code"
// @Success 200 {object} utils.Response "2FA disabled successfully"
// @Failure 400 {object} utils.Response "invalid PIN | invalid authenticator code | 2FA not enabled"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /users/me/2fa/disable [post]
func (h *UserHandler) DisableTwoFA(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req DisableTwoFARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	db := database.GetDB()
	var sec models.UserSecurity
	if err := db.Where("user_id = ?", claims.UserID).First(&sec).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.ErrorResponse(c, http.StatusBadRequest, "2FA not enabled", nil)
			return
		}
		utils.ServiceErrorResponse(c, err)
		return
	}

	if !sec.TwoFAEnabled || strings.TrimSpace(sec.TwoFASecret) == "" {
		utils.ErrorResponse(c, http.StatusBadRequest, "2FA not enabled", nil)
		return
	}

	// Verify PIN.
	if !sec.PinEnabled || strings.TrimSpace(sec.PinHash) == "" {
		utils.ErrorResponse(c, http.StatusBadRequest, "PIN not configured", nil)
		return
	}
	if err := utils.VerifyPIN(sec.PinHash, req.Pin); err != nil {
		logger.Ctx(c).Warn("2FA disable failed: invalid PIN", zap.String("user_id", claims.UserID.String()))
		utils.ErrorResponse(c, http.StatusBadRequest, "invalid PIN", nil)
		return
	}

	// Verify TOTP code.
	if !utils.ValidateTOTPCode(sec.TwoFASecret, req.Code) {
		logger.Ctx(c).Warn("2FA disable failed: invalid code", zap.String("user_id", claims.UserID.String()))
		utils.ErrorResponse(c, http.StatusBadRequest, "invalid authenticator code", nil)
		return
	}
	if err := service.ConsumeTOTPCode(claims.UserID, req.Code); err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	sec.TwoFAEnabled = false
	sec.TwoFASecret = ""
	if err := db.Save(&sec).Error; err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	logger.Ctx(c).Info("2FA disabled", zap.String("user_id", claims.UserID.String()))
	utils.SuccessResponse(c, http.StatusOK, "2FA disabled successfully", nil)
}

// requireTier1 is a helper to enforce Tier 1 KYC verification for sensitive operations.
func (h *UserHandler) requireTier1(c *gin.Context, userID uuid.UUID) bool {
	var kyc models.KYCVerification
	if err := database.GetDB().Where("user_id = ?", userID).First(&kyc).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			utils.ErrorResponse(c, http.StatusForbidden, "User is not verified", nil)
			return false
		}
		utils.ServiceErrorResponse(c, err)
		return false
	}
	if kyc.Tier < models.KYCTier1 {
		utils.ErrorResponse(c, http.StatusForbidden, "User is not verified", nil)
		return false
	}
	return true
}

// GetWalletAddress retrieves (or creates)
// @Summary Get wallet address for chain
// @Description Return the user's wallet address for a given chain on mainnet; if missing, create via Quidax and persist.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param chain query string true "Chain key (e.g. bep20, erc20, trc20)"
// @Param currency query string true "Currency symbol (e.g. USDT)"
// @Success 200 {object} utils.Response{data=WalletAddressResponse}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Failure 500 {object} utils.Response
// @Router /users/me/wallet-address [get]
func (h *UserHandler) GetWalletAddress(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	if !h.requireTier1(c, claims.UserID) {
		return
	}

	chain := c.Query("chain")
	if chain == "" {
		utils.ErrorResponse(c, http.StatusBadRequest, "chain is required", nil)
		return
	}
	currency := c.Query("currency")
	if currency == "" {
		utils.ErrorResponse(c, http.StatusBadRequest, "currency is required", nil)
		return
	}

	if h.walletService == nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	const network = "mainnet"
	addr, created, err := h.walletService.GetOrCreateAddress(c.Request.Context(), claims.UserID, chain, network, currency)
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	resp := WalletAddressResponse{
		Chain:   chain,
		Address: addr.Address,
		Created: created,
	}

	utils.SuccessResponse(c, http.StatusOK, "Wallet address retrieved", resp)
}

// GetOrCreateDepositAccount is not available in this version.
func (h *UserHandler) GetOrCreateDepositAccount(c *gin.Context) {
	utils.ErrorResponse(c, http.StatusServiceUnavailable, "Fiat deposits are not available in this version", nil)
}

// ListFiatBanks is not available in this version.
func (h *UserHandler) ListFiatBanks(c *gin.Context) {
	utils.ErrorResponse(c, http.StatusServiceUnavailable, "Fiat banking is not available in this version", nil)
}

// LookupFiatBankAccount is not available in this version.
func (h *UserHandler) LookupFiatBankAccount(c *gin.Context) {
	utils.ErrorResponse(c, http.StatusServiceUnavailable, "Fiat banking is not available in this version", nil)
}

// ListWallets returns the authenticated user's wallets (balances per currency).
// @Summary Get my wallets
// @Description List all wallets (balances per currency) for the authenticated user
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} utils.Response{data=[]models.WalletResponse} "Wallets retrieved successfully"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /users/me/wallets [get]
func (h *UserHandler) ListWallets(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	if h.walletService == nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	wallets, err := h.walletService.ListUserWallets(c.Request.Context(), claims.UserID)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Wallets retrieved successfully", wallets)
}

// ListWalletTransactions returns enriched, paginated transaction history for the authenticated user.
// Each transaction is resolved against its source record so the response includes status,
// counterparty details, fees, and type-specific fields (bank/crypto).
// @Summary Get my wallet transactions
// @Description List enriched wallet transactions for the authenticated user, optionally filtered by currency
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param currency query string false "Currency symbol (e.g. USDT)"
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Items per page" default(10)
// @Success 200 {object} utils.PaginatedResponse{data=[]models.TransactionHistoryItem} "Wallet transactions retrieved successfully"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /users/me/wallet-transactions [get]
func (h *UserHandler) ListWalletTransactions(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	if h.walletService == nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	currency := strings.ToUpper(strings.TrimSpace(c.Query("currency")))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	items, total, err := h.walletService.ListUserTransactionHistory(c.Request.Context(), claims.UserID, currency, page, pageSize)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	pagination := utils.CalculatePagination(page, pageSize, total)

	utils.PaginatedSuccessResponse(c, http.StatusOK, "Wallet transactions retrieved successfully", items, pagination)
}

// CryptoWithdraw creates a crypto withdrawal via Quidax.
// @Summary Create crypto withdrawal
// @Description Initiate an on-chain crypto withdrawal via Quidax, protected by a 6-digit PIN and 6-digit authenticator (TOTP) code.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param Idempotency-Key header string true "Unique idempotency key (UUID v4)"
// @Param request body CryptoWithdrawRequest true "Crypto withdrawal details"
// @Success 201 {object} utils.Response{data=models.CryptoWithdrawal} "Withdrawal initiated successfully"
// @Failure 400 {object} utils.Response "Invalid request or insufficient balance"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 403 {object} utils.Response "Tier 1 required"
// @Failure 409 {object} utils.Response "Duplicate request in progress"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /users/me/crypto-withdrawals [post]
func (h *UserHandler) CryptoWithdraw(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	if !h.requireTier1(c, claims.UserID) {
		return
	}

	if h.walletService == nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	var req CryptoWithdrawRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	amountStr := strings.TrimSpace(req.Amount)
	amount, err := decimal.NewFromString(amountStr)
	if err != nil {
		utils.ValidationErrorResponse(c, "invalid amount format")
		return
	}
	if !amount.IsPositive() {
		utils.ValidationErrorResponse(c, "amount must be greater than zero")
		return
	}

	const network = "mainnet"
	withdrawal, err := h.walletService.CryptoWithdraw(
		c.Request.Context(),
		claims.UserID,
		req.Chain,
		network,
		req.Currency,
		req.Address,
		req.Pin,
		req.AuthCode,
		req.Note,
		amount,
	)
	if err != nil {
		if errors.Is(err, service.ErrTwoFACodeRequired) {
			c.JSON(http.StatusForbidden, gin.H{
				"success":      false,
				"message":      "2FA code required",
				"requires_2fa": true,
				"data":         gin.H{"requires_2fa": true},
			})
			return
		}
		var pinErr *service.ErrPINRateLimited
		if errors.As(err, &pinErr) {
			c.Header("Retry-After", strconv.FormatInt(int64(pinErr.RetryAfter.Seconds()), 10))
			utils.ErrorResponse(c, http.StatusLocked, "Too many failed PIN attempts. Please try again later.", nil)
			return
		}
		logger.Ctx(c).Warn("Crypto withdrawal failed",
			zap.String("user_id", claims.UserID.String()),
			zap.String("chain", req.Chain),
			zap.String("currency", req.Currency),
			zap.String("amount", amountStr),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Crypto withdrawal initiated",
		zap.String("user_id", claims.UserID.String()),
		zap.String("chain", req.Chain),
		zap.String("currency", req.Currency),
		zap.String("amount", amountStr),
	)
	utils.SuccessResponse(c, http.StatusCreated, "Withdrawal initiated successfully", withdrawal)
}

// FiatWithdraw is not available in this version.
func (h *UserHandler) FiatWithdraw(c *gin.Context) {
	utils.ErrorResponse(c, http.StatusServiceUnavailable, "Fiat withdrawals are not available in this version", nil)
}

// InternalTransfer performs an internal transfer between users identified by UID or email.
// @Summary Create internal transfer
// @Description Transfer funds between users by receiver UID or email. Currency is provided by currency_id (from reference currencies). Protected by a 6-digit PIN and 6-digit authenticator (TOTP) code.
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param Idempotency-Key header string true "Unique idempotency key (UUID v4)"
// @Param request body InternalTransferRequest true "Internal transfer details"
// @Success 200 {object} utils.Response{data=models.InternalTransfer} "Transfer completed successfully"
// @Failure 400 {object} utils.Response "Invalid request or insufficient balance"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 409 {object} utils.Response "Duplicate request in progress"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /users/me/internal-transfer [post]
func (h *UserHandler) InternalTransfer(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	if h.walletService == nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	var req InternalTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	amountStr := strings.TrimSpace(req.Amount)
	amount, err := decimal.NewFromString(amountStr)
	if err != nil {
		utils.ValidationErrorResponse(c, "invalid amount format")
		return
	}
	if !amount.IsPositive() {
		utils.ValidationErrorResponse(c, "amount must be greater than zero")
		return
	}

	transfer, err := h.walletService.InternalTransfer(
		c.Request.Context(),
		claims.UserID,
		req.ReceiverUID,
		req.ReceiverEmail,
		req.CurrencyID,
		req.Pin,
		req.AuthCode,
		amount,
	)
	if err != nil {
		if errors.Is(err, service.ErrTwoFACodeRequired) {
			c.JSON(http.StatusForbidden, gin.H{
				"success":      false,
				"message":      "2FA code required",
				"requires_2fa": true,
				"data":         gin.H{"requires_2fa": true},
			})
			return
		}
		var pinErr *service.ErrPINRateLimited
		if errors.As(err, &pinErr) {
			c.Header("Retry-After", strconv.FormatInt(int64(pinErr.RetryAfter.Seconds()), 10))
			utils.ErrorResponse(c, http.StatusLocked, "Too many failed PIN attempts. Please try again later.", nil)
			return
		}
		logger.Ctx(c).Warn("Internal transfer failed",
			zap.String("user_id", claims.UserID.String()),
			zap.String("currency_id", req.CurrencyID.String()),
			zap.String("amount", amountStr),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Internal transfer completed",
		zap.String("user_id", claims.UserID.String()),
		zap.String("currency_id", req.CurrencyID.String()),
		zap.String("amount", amountStr),
	)
	utils.SuccessResponse(c, http.StatusOK, "Transfer completed successfully", transfer)
}

// ListUsers retrieves a paginated list of users (admin only)
// @Summary List all users
// @Description Retrieve a paginated list of all users (admin only)
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Items per page" default(10)
// @Success 200 {object} utils.PaginatedResponse{data=[]models.UserResponse} "Users retrieved successfully"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 403 {object} utils.Response "Admin access required"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /users [get]
func (h *UserHandler) ListUsers(c *gin.Context) {
	// Get pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	// Get users
	users, total, err := h.userService.List(page, pageSize)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	// Convert to response format
	userResponses := make([]interface{}, len(users))
	for i, user := range users {
		userResponses[i] = user.ToResponse()
	}

	// Calculate pagination
	pagination := utils.CalculatePagination(page, pageSize, total)

	utils.PaginatedSuccessResponse(c, http.StatusOK, "Users retrieved successfully", userResponses, pagination)
}

// GetUser retrieves a user by ID (admin only)
// @Summary Get user by ID
// @Description Retrieve a specific user's information by ID (admin only)
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "User ID"
// @Success 200 {object} utils.Response{data=models.UserResponse} "User retrieved successfully"
// @Failure 400 {object} utils.Response "Invalid user ID"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 403 {object} utils.Response "Admin access required"
// @Failure 404 {object} utils.Response "User not found"
// @Router /users/{id} [get]
func (h *UserHandler) GetUser(c *gin.Context) {
	// Get caller claims to enforce basic IDOR protections.
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	// Get user ID from URL
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "Invalid user ID", nil)
		return
	}

	// Prevent non-super-admins from accessing their own admin record via
	// the generic admin listing endpoints. Self-introspection should go
	// through /users/me, which has more conservative fields.
	if userID == claims.UserID {
		utils.ForbiddenResponse(c, "Use /users/me to access your own profile")
		return
	}

	// Get user
	user, err := h.userService.GetByID(userID)
	if err != nil {
		utils.NotFoundResponse(c, utils.SanitizeServiceError(err))
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "User retrieved successfully", user.ToResponse())
}

// DeleteUser deletes a user by ID (admin only)
// @Summary Delete user
// @Description Delete a user by ID (admin only)
// @Tags users
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "User ID"
// @Success 200 {object} utils.Response "User deleted successfully"
// @Failure 400 {object} utils.Response "Invalid user ID or cannot delete user"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 403 {object} utils.Response "Admin access required"
// @Router /users/{id} [delete]
func (h *UserHandler) DeleteUser(c *gin.Context) {
	// Get caller claims to prevent self-deletion and enforce basic privilege
	// separation between admins.
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	// Get user ID from URL
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "Invalid user ID", nil)
		return
	}

	// Disallow self-deletion via admin endpoint to reduce risk of accidental or
	// malicious lockouts. Users should use /users/me for self-service deletion.
	if userID == claims.UserID {
		utils.ForbiddenResponse(c, "Admins cannot delete their own account via this endpoint")
		return
	}

	// TODO: When user roles include a super-admin tier, enforce that admins
	// cannot delete accounts with equal or higher privileges here.

	// Delete user
	if err := h.userService.Delete(userID); err != nil {
		logger.Ctx(c).Error("Admin delete user failed",
			zap.String("target_user_id", userID.String()),
			zap.String("admin_user_id", claims.UserID.String()),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Admin deleted user",
		zap.String("target_user_id", userID.String()),
		zap.String("admin_user_id", claims.UserID.String()),
	)
	utils.SuccessResponse(c, http.StatusOK, "User deleted successfully", nil)
}
