package handler

import (
	"errors"
	"net/http"

	"github.com/Kynettic-org/kynettic-backend/internal/middleware"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"go.uber.org/zap"
)

// preAuthTokenTTLSeconds is the lifetime of a pre_auth token in seconds,
// kept in sync with service.preAuthTokenTTL for use in the response body.
const preAuthTokenTTLSeconds = 300

// AuthHandler handles authentication requests
type AuthHandler struct {
	authService service.AuthService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService service.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// RequestRegistrationOTPRequest represents the OTP request body
type RequestRegistrationOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// VerifyRegistrationOTPRequest represents the OTP verification body
type VerifyRegistrationOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
	OTP   string `json:"otp" binding:"required,len=6"`
}

// SetPasswordRequest represents the final registration step (set password)
type SetPasswordRequest struct {
	RegistrationToken string `json:"registration_token" binding:"required"`
	Password          string `json:"password" binding:"required,min=12"`
	ReferralCode      string `json:"referral_code"`
}

// ForgotPasswordRequestOTPRequest represents the forgot-password OTP request body
type ForgotPasswordRequestOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
}

// ForgotPasswordVerifyOTPRequest represents the forgot-password OTP verification body
type ForgotPasswordVerifyOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
	OTP   string `json:"otp" binding:"required,len=6"`
}

// ForgotPasswordResetRequest represents the final forgot-password step
type ForgotPasswordResetRequest struct {
	ResetToken  string `json:"reset_token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=12"`
}

// LoginRequest represents the login request body
type LoginRequest struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required"`
	DeviceType string `json:"device_type" binding:"required,oneof=web mobile"`
}

// TwoFALoginRequest represents the legacy 2FA login request body (email+password+code in one step).
type TwoFALoginRequest struct {
	Email      string `json:"email" binding:"required,email"`
	Password   string `json:"password" binding:"required"`
	Code       string `json:"code" binding:"required,len=6"`
	DeviceType string `json:"device_type" binding:"required,oneof=web mobile"`
}

// VerifyTwoFARequest is the body for the two-step 2FA verify endpoint.
type VerifyTwoFARequest struct {
	PreAuthToken string `json:"pre_auth_token" binding:"required"`
	Code         string `json:"code" binding:"required,len=6"`
}

// RefreshTokenRequest represents the refresh token request body
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// SocialLoginRequest represents a generic social login request that carries an ID token.
type SocialLoginRequest struct {
	IDToken      string `json:"id_token" binding:"required"`
	Nonce        string `json:"nonce" binding:"required"`
	DeviceType   string `json:"device_type" binding:"required,oneof=web mobile"`
	ReferralCode string `json:"referral_code"`
}

// AuthResponse represents the authentication response
type AuthResponse struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	User         interface{} `json:"user"`
}

// RequestRegistrationOTP sends a 6-digit OTP to the user's email.
// @Summary Request registration OTP
// @Description Send a 6-digit OTP to email (valid for 10 minutes). User is created only after OTP verification + password set. Always returns 200 to prevent email enumeration.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RequestRegistrationOTPRequest true "OTP Request"
// @Success 200 {object} utils.Response "If this email is eligible for registration, an OTP has been sent"
// @Failure 422 {object} utils.Response "Invalid email format"
// @Router /auth/register/request-otp [post]
func (h *AuthHandler) RequestRegistrationOTP(c *gin.Context) {
	var req RequestRegistrationOTPRequest

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

	if err := h.authService.RequestRegistrationOTP(req.Email); err != nil {
		// Log internally but never reveal whether the email is registered or
		// rate-limited — doing so would allow account enumeration.
		logger.Ctx(c).Warn("Registration OTP request failed",
			zap.String("email", req.Email),
			zap.Error(err),
		)
	}

	utils.SuccessResponse(c, http.StatusOK, "If this email is eligible for registration, an OTP has been sent", nil)
}

// VerifyRegistrationOTP verifies the OTP and returns a registration token.
// @Summary Verify registration OTP
// @Description Verify OTP and return a short-lived registration token used to set password.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body VerifyRegistrationOTPRequest true "OTP Verification"
// @Success 200 {object} utils.Response{data=map[string]string} "OTP verified, registration token returned"
// @Failure 400 {object} utils.Response "otp not found or expired | too many invalid otp attempts | invalid otp"
// @Failure 422 {object} utils.Response "Invalid request format"
// @Router /auth/register/verify-otp [post]
func (h *AuthHandler) VerifyRegistrationOTP(c *gin.Context) {
	var req VerifyRegistrationOTPRequest

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

	token, err := h.authService.VerifyRegistrationOTP(req.Email, req.OTP)
	if err != nil {
		logger.Ctx(c).Warn("Registration OTP verification failed",
			zap.String("email", req.Email),
			zap.Error(err),
		)
		if errors.Is(err, service.ErrOTPRateLimited) {
			utils.ErrorResponse(c, http.StatusTooManyRequests, "Too many invalid OTP attempts. Please request a new OTP.", nil)
			return
		}
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "OTP verified", map[string]string{"registration_token": token})
}

// SetPassword completes registration after OTP verification.
// @Summary Set registration password
// @Description Create user after OTP verification by setting password (names are collected later).
// @Tags auth
// @Accept json
// @Produce json
// @Param request body SetPasswordRequest true "Set Password"
// @Success 201 {object} utils.Response{data=models.UserResponse} "User registered successfully"
// @Failure 400 {object} utils.Response "invalid or expired registration token | password must be at least 12 characters long and include upper, lower, number, and symbol | user with this email already exists"
// @Failure 422 {object} utils.Response "Invalid request format"
// @Router /auth/register/set-password [post]
func (h *AuthHandler) SetPassword(c *gin.Context) {
	var req SetPasswordRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		// Ensure we surface user-friendly, field-specific errors (including min length).
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
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

	user, err := h.authService.SetPassword(req.RegistrationToken, req.Password, req.ReferralCode)
	if err != nil {
		logger.Ctx(c).Warn("Set password failed", zap.Error(err))
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("User registered successfully", zap.String("user_id", user.ID.String()))
	utils.SuccessResponse(c, http.StatusCreated, "User registered successfully", user.ToResponse())
}

// ResendRegistrationOTP resends the registration OTP to the user's email.
// @Summary Resend registration OTP
// @Description Resend the 6-digit registration OTP. Subject to the same rate limits as the initial request (60s minimum between sends, max 3 per 10-minute window). Always returns 200 to prevent email enumeration.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RequestRegistrationOTPRequest true "Email to resend OTP to"
// @Success 200 {object} utils.Response "If this email is eligible for registration, an OTP has been resent"
// @Failure 422 {object} utils.Response "Invalid email format"
// @Router /auth/register/resend-otp [post]
func (h *AuthHandler) ResendRegistrationOTP(c *gin.Context) {
	var req RequestRegistrationOTPRequest

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

	if err := h.authService.RequestRegistrationOTP(req.Email); err != nil {
		logger.Ctx(c).Warn("Registration OTP resend failed",
			zap.String("email", req.Email),
			zap.Error(err),
		)
	}

	utils.SuccessResponse(c, http.StatusOK, "If this email is eligible for registration, an OTP has been resent", nil)
}

// ForgotPasswordRequestOTP sends a 6-digit OTP to the user's email for password reset.
// @Summary Request password reset OTP
// @Description Send a 6-digit OTP to email (valid for 10 minutes). Always returns 200 to prevent email enumeration.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body ForgotPasswordRequestOTPRequest true "Password reset OTP request"
// @Success 200 {object} utils.Response "If this email is registered, an OTP has been sent"
// @Failure 422 {object} utils.Response "Invalid email format"
// @Router /auth/forgot-password/request-otp [post]
func (h *AuthHandler) ForgotPasswordRequestOTP(c *gin.Context) {
	var req ForgotPasswordRequestOTPRequest

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

	if err := h.authService.RequestPasswordResetOTP(req.Email); err != nil {
		// Log internally but never reveal whether the email is registered or
		// rate-limited — doing so would allow account enumeration.
		logger.Ctx(c).Warn("Password reset OTP request failed",
			zap.String("email", req.Email),
			zap.Error(err),
		)
	}

	utils.SuccessResponse(c, http.StatusOK, "If this email is registered, an OTP has been sent", nil)
}

// ResendForgotPasswordOTP resends the password reset OTP to the user's email.
// @Summary Resend password reset OTP
// @Description Resend the 6-digit password reset OTP. Subject to the same rate limits as the initial request (60s minimum between sends, max 3 per 10-minute window). Always returns 200 to prevent email enumeration.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body ForgotPasswordRequestOTPRequest true "Email to resend OTP to"
// @Success 200 {object} utils.Response "If this email is registered, an OTP has been resent"
// @Failure 422 {object} utils.Response "Invalid email format"
// @Router /auth/forgot-password/resend-otp [post]
func (h *AuthHandler) ResendForgotPasswordOTP(c *gin.Context) {
	var req ForgotPasswordRequestOTPRequest

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

	if err := h.authService.RequestPasswordResetOTP(req.Email); err != nil {
		logger.Ctx(c).Warn("Password reset OTP resend failed",
			zap.String("email", req.Email),
			zap.Error(err),
		)
	}

	utils.SuccessResponse(c, http.StatusOK, "If this email is registered, an OTP has been resent", nil)
}

// ForgotPasswordVerifyOTP verifies the OTP and returns a reset token.
// @Summary Verify password reset OTP
// @Description Verify OTP and return a short-lived reset token used to set a new password.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body ForgotPasswordVerifyOTPRequest true "Password reset OTP verification"
// @Success 200 {object} utils.Response{data=map[string]string} "OTP verified, reset token returned"
// @Failure 400 {object} utils.Response "otp not found or expired | too many invalid otp attempts | invalid otp"
// @Failure 422 {object} utils.Response "Invalid request format"
// @Router /auth/forgot-password/verify-otp [post]
func (h *AuthHandler) ForgotPasswordVerifyOTP(c *gin.Context) {
	var req ForgotPasswordVerifyOTPRequest

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

	token, err := h.authService.VerifyPasswordResetOTP(req.Email, req.OTP)
	if err != nil {
		logger.Ctx(c).Warn("Password reset OTP verification failed",
			zap.String("email", req.Email),
			zap.Error(err),
		)
		if errors.Is(err, service.ErrOTPRateLimited) {
			utils.ErrorResponse(c, http.StatusTooManyRequests, "Too many invalid OTP attempts. Please request a new OTP.", nil)
			return
		}
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "OTP verified", map[string]string{"reset_token": token})
}

// ForgotPasswordReset sets a new password using a valid reset token.
// @Summary Reset password
// @Description Reset password after OTP verification.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body ForgotPasswordResetRequest true "Reset password"
// @Success 200 {object} utils.Response "Password reset successfully"
// @Failure 400 {object} utils.Response "invalid or expired reset token | password must be at least 12 characters long and include upper, lower, number, and symbol | user not found | account is deactivated"
// @Failure 422 {object} utils.Response "Invalid request format"
// @Router /auth/forgot-password/reset [post]
func (h *AuthHandler) ForgotPasswordReset(c *gin.Context) {
	var req ForgotPasswordResetRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		// Ensure we surface user-friendly, field-specific errors (including min length).
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
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

	if err := h.authService.ResetPassword(req.ResetToken, req.NewPassword); err != nil {
		logger.Ctx(c).Warn("Password reset failed", zap.Error(err))
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Password reset successfully")
	utils.SuccessResponse(c, http.StatusOK, "Password reset successfully", nil)
}

// Login handles user login
// @Summary User login
// @Description Authenticate user with email and password. Returns full tokens when 2FA is disabled. Returns 202 with a short-lived pre_auth_token when 2FA is enabled — exchange it via POST /auth/2fa/verify.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "Login credentials"
// @Success 200 {object} utils.Response{data=AuthResponse} "Login successful"
// @Success 202 {object} utils.Response{data=map[string]interface{}} "2FA required — pre_auth_token returned"
// @Failure 401 {object} utils.Response "invalid email or password | account is deactivated | too many failed login attempts"
// @Failure 422 {object} utils.Response "Invalid request format"
// @Router /auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest

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

	result, err := h.authService.Login(req.Email, req.Password, req.DeviceType, c.ClientIP())
	if err != nil {
		logger.Ctx(c).Warn("Login failed",
			zap.String("email", req.Email),
			zap.String("device_type", req.DeviceType),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusUnauthorized, utils.SanitizeServiceError(err), nil)
		return
	}

	// 2FA required — return a pre_auth token; the client must not store the password.
	if result.PreAuthToken != "" {
		logger.Ctx(c).Info("2FA required — pre_auth token issued", zap.String("email", req.Email))
		utils.SuccessResponse(c, http.StatusAccepted, "2FA verification required", map[string]interface{}{
			"pre_auth_token": result.PreAuthToken,
			"expires_in":     int(preAuthTokenTTLSeconds),
		})
		return
	}

	response := AuthResponse{
		AccessToken:  result.AccessToken,
		RefreshToken: result.RefreshToken,
		User:         result.User.ToResponse(),
	}

	logger.Ctx(c).Info("Login successful",
		zap.String("user_id", result.User.ID.String()),
		zap.String("device_type", req.DeviceType),
	)
	utils.SuccessResponse(c, http.StatusOK, "Login successful", response)
}

// VerifyTwoFA exchanges a pre_auth token and TOTP code for full session tokens.
// @Summary Verify 2FA and complete login
// @Description Exchange a pre_auth_token (from POST /auth/login) and a TOTP code for access and refresh tokens.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body VerifyTwoFARequest true "Pre-auth token and TOTP code"
// @Success 200 {object} utils.Response{data=AuthResponse} "Login successful"
// @Failure 401 {object} utils.Response "invalid or expired pre-auth token | invalid authenticator code"
// @Failure 422 {object} utils.Response "Invalid request format"
// @Router /auth/2fa/verify [post]
func (h *AuthHandler) VerifyTwoFA(c *gin.Context) {
	var req VerifyTwoFARequest

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

	accessToken, refreshToken, user, err := h.authService.VerifyTwoFA(req.PreAuthToken, req.Code)
	if err != nil {
		logger.Ctx(c).Warn("2FA verification failed", zap.Error(err))
		utils.ErrorResponse(c, http.StatusUnauthorized, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("2FA verification successful", zap.String("user_id", user.ID.String()))
	utils.SuccessResponse(c, http.StatusOK, "Login successful", AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user.ToResponse(),
	})
}

// LoginWith2FA handles user login with 2FA code
// @Summary User login with 2FA
// @Description Authenticate user with email, password, and TOTP code
// @Tags auth
// @Accept json
// @Produce json
// @Param request body TwoFALoginRequest true "Login credentials with 2FA code"
// @Success 200 {object} utils.Response{data=AuthResponse} "Login successful"
// @Failure 401 {object} utils.Response "invalid email or password | account is deactivated | too many failed login attempts; please try again later | 2FA not configured for this account | 2FA not enabled for this account | invalid authenticator code"
// @Failure 422 {object} utils.Response "Invalid request format"
// @Router /auth/2fa/login [post]
func (h *AuthHandler) LoginWith2FA(c *gin.Context) {
	var req TwoFALoginRequest

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

	// Login user with 2FA
	accessToken, refreshToken, user, err := h.authService.LoginWith2FA(req.Email, req.Password, req.Code, req.DeviceType, c.ClientIP())
	if err != nil {
		logger.Ctx(c).Warn("2FA login failed",
			zap.String("email", req.Email),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusUnauthorized, utils.SanitizeServiceError(err), nil)
		return
	}

	response := AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user.ToResponse(),
	}

	utils.SuccessResponse(c, http.StatusOK, "Login successful", response)
}

// RefreshToken handles token refresh
// @Summary Refresh access token
// @Description Generate a new access token using a valid refresh token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RefreshTokenRequest true "Refresh token"
// @Success 200 {object} utils.Response{data=map[string]string} "Token refreshed successfully"
// @Failure 401 {object} utils.Response "Invalid refresh token"
// @Failure 422 {object} utils.Response "Invalid request format"
// @Router /auth/refresh [post]
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest

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

	// Refresh token
	accessToken, err := h.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		logger.Ctx(c).Warn("Token refresh failed", zap.Error(err))
		utils.ErrorResponse(c, http.StatusUnauthorized, "Invalid refresh token", nil)
		return
	}

	response := map[string]string{
		"access_token": accessToken,
	}

	utils.SuccessResponse(c, http.StatusOK, "Token refreshed successfully", response)
}

// LoginWithGoogle handles login via Google ID token.
// @Summary Login with Google
// @Description Authenticate or register a user using a Google ID token and return access/refresh tokens.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body SocialLoginRequest true "Google ID token"
// @Success 200 {object} utils.Response{data=AuthResponse} "Login successful"
// @Failure 401 {object} utils.Response "invalid Google ID token | account is deactivated"
// @Failure 422 {object} utils.Response "Invalid request format"
// @Router /auth/google [post]
func (h *AuthHandler) LoginWithGoogle(c *gin.Context) {
	var req SocialLoginRequest

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

	accessToken, refreshToken, user, err := h.authService.LoginWithGoogle(c.Request.Context(), req.IDToken, req.Nonce, req.DeviceType, req.ReferralCode)
	if err != nil {
		logger.Ctx(c).Warn("Google login failed", zap.Error(err))
		utils.ErrorResponse(c, http.StatusUnauthorized, utils.SanitizeServiceError(err), nil)
		return
	}

	response := AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user.ToResponse(),
	}

	utils.SuccessResponse(c, http.StatusOK, "Login successful", response)
}

// LoginWithApple handles login via Apple ID token.
// @Summary Login with Apple
// @Description Authenticate or register a user using an Apple ID token and return access/refresh tokens.
// @Tags auth
// @Accept json
// @Produce json
// @Param request body SocialLoginRequest true "Apple ID token"
// @Success 200 {object} utils.Response{data=AuthResponse} "Login successful"
// @Failure 401 {object} utils.Response "invalid Apple ID token | account is deactivated"
// @Failure 422 {object} utils.Response "Invalid request format"
// @Router /auth/apple [post]
func (h *AuthHandler) LoginWithApple(c *gin.Context) {
	var req SocialLoginRequest

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

	accessToken, refreshToken, user, err := h.authService.LoginWithApple(c.Request.Context(), req.IDToken, req.Nonce, req.DeviceType, req.ReferralCode)
	if err != nil {
		logger.Ctx(c).Warn("Apple login failed", zap.Error(err))
		utils.ErrorResponse(c, http.StatusUnauthorized, utils.SanitizeServiceError(err), nil)
		return
	}

	response := AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user.ToResponse(),
	}

	utils.SuccessResponse(c, http.StatusOK, "Login successful", response)
}

// Logout invalidates the current session for the user's device type.
// @Summary Logout
// @Description Invalidate the current session. The user's session on the other device type (if any) is not affected.
// @Tags auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} utils.Response "Logged out successfully"
// @Failure 401 {object} utils.Response "Authentication required"
// @Router /auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	if claims.DeviceType == "" {
		// Token was issued before session enforcement; nothing to invalidate.
		utils.SuccessResponse(c, http.StatusOK, "Logged out successfully", nil)
		return
	}

	if err := h.authService.Logout(claims.UserID, claims.DeviceType); err != nil {
		logger.Ctx(c).Error("Logout failed",
			zap.String("user_id", claims.UserID.String()),
			zap.Error(err),
		)
		utils.ServiceErrorResponse(c, err)
		return
	}

	logger.Ctx(c).Info("User logged out",
		zap.String("user_id", claims.UserID.String()),
		zap.String("device_type", claims.DeviceType),
	)
	utils.SuccessResponse(c, http.StatusOK, "Logged out successfully", nil)
}
