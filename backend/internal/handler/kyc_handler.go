package handler

import (
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/clients/cloudinary"
	"github.com/Kynettic-org/kynettic-backend/internal/middleware"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"go.uber.org/zap"
)

const (
	// maxKYCUploadBodyBytes is the per-request body cap applied at the start of
	// SubmitTier3 in place of the global 1 MiB limit, which is too small for
	// image files. It covers both files (selfie + utility bill) plus form fields.
	maxKYCUploadBodyBytes = 25 << 20 // 25 MiB

	// maxKYCFileBytes is the per-file size limit enforced for each uploaded file.
	// Kept small enough to prevent memory exhaustion (both io.ReadAll for the
	// selfie and cloudinary.UploadImage for the utility bill buffer into RAM).
	maxKYCFileBytes = 10 << 20 // 10 MiB
)

// KYCHandler handles KYC-related HTTP requests
type KYCHandler struct {
	kycService       service.KYCService
	cloudinaryClient *cloudinary.Client
	cloudinaryFolder string
}

// NewKYCHandler creates a new KYC handler
func NewKYCHandler(kycService service.KYCService, cloudinaryClient *cloudinary.Client, cloudinaryFolder string) *KYCHandler {
	return &KYCHandler{
		kycService:       kycService,
		cloudinaryClient: cloudinaryClient,
		cloudinaryFolder: cloudinaryFolder,
	}
}

// GetStatus retrieves the current user's KYC status
// @Summary Get KYC status
// @Description Retrieve the authenticated user's KYC verification status and tier
// @Tags kyc
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} utils.Response{data=models.KYCStatusResponse} "KYC status retrieved successfully"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /users/me/kyc/status [get]
func (h *KYCHandler) GetStatus(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	status, err := h.kycService.GetKYCStatus(claims.UserID)
	if err != nil {
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "KYC status retrieved successfully", status)
}

// SubmitTier1Request represents the request body for Tier 1 KYC submission (BVN)
type SubmitTier1Request struct {
	FirstName            string `json:"first_name" validate:"required,min=2,max=100"`
	LastName             string `json:"last_name" validate:"required,min=2,max=100"`
	Username             string `json:"username" validate:"required,min=3,max=50"`
	DisplayUsernameOnP2P bool   `json:"display_username_on_p2p"`
	DateOfBirth          string `json:"date_of_birth" validate:"required"`
	PhoneNumber          string `json:"phone_number" validate:"required,min=10,max=20"`
	BVN                  string `json:"bvn" validate:"required,len=11"`
}

// SubmitTier1 processes Tier 1 KYC verification
// @Summary Submit Tier 1 KYC
// @Description Submit user details and BVN for Tier 1 verification
// @Tags kyc
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body SubmitTier1Request true "Tier 1 verification details"
// @Success 200 {object} utils.Response "Tier 1 verification completed successfully"
// @Failure 400 {object} utils.Response "Invalid request or verification failed"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /users/me/kyc/tier1 [post]
func (h *KYCHandler) SubmitTier1(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		logger.Ctx(c).Warn("Unauthorized access to SubmitTier1")
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req SubmitTier1Request
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Ctx(c).Warn("Failed to bind JSON in SubmitTier1", zap.String("user_id", claims.UserID.String()), zap.Error(err))
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			logger.Ctx(c).Warn("Validation failed for SubmitTier1", zap.String("user_id", claims.UserID.String()), zap.Any("validation_errors", validationErrors))
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	// Convert to service request
	serviceReq := &service.Tier1Request{
		FirstName:            req.FirstName,
		LastName:             req.LastName,
		Username:             req.Username,
		DisplayUsernameOnP2P: req.DisplayUsernameOnP2P,
		DateOfBirth:          req.DateOfBirth,
		PhoneNumber:          req.PhoneNumber,
		BVN:                  req.BVN,
	}

	if err := h.kycService.SubmitTier1(c.Request.Context(), claims.UserID, serviceReq); err != nil {
		logger.Ctx(c).Warn("Tier 1 KYC submission failed",
			zap.String("user_id", claims.UserID.String()),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Tier 1 KYC completed", zap.String("user_id", claims.UserID.String()))
	utils.SuccessResponse(c, http.StatusOK, "Tier 1 verification completed successfully", nil)
}

// SubmitTier2Request represents the request body for Tier 2 KYC submission (NIN)
type SubmitTier2Request struct {
	NIN string `json:"nin" validate:"required,len=11"`
}

// SubmitTier2 processes Tier 2 KYC verification
// @Summary Submit Tier 2 KYC
// @Description Submit NIN for Tier 2 verification
// @Tags kyc
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body SubmitTier2Request true "Tier 2 verification details"
// @Success 200 {object} utils.Response "Tier 2 verification completed successfully"
// @Failure 400 {object} utils.Response "Invalid request or verification failed"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /users/me/kyc/tier2 [post]
func (h *KYCHandler) SubmitTier2(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		logger.Ctx(c).Warn("Unauthorized access to SubmitTier2")
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	var req SubmitTier2Request
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Ctx(c).Warn("Failed to bind JSON in SubmitTier2", zap.String("user_id", claims.UserID.String()), zap.Error(err))
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	if err := utils.ValidateStruct(req); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			logger.Ctx(c).Warn("Validation failed for SubmitTier2", zap.String("user_id", claims.UserID.String()), zap.Any("validation_errors", validationErrors))
			utils.ValidationErrorResponse(c, utils.FormatValidationErrors(validationErrors))
			return
		}
		logger.Ctx(c).Warn("Validation failed for SubmitTier2", zap.String("user_id", claims.UserID.String()), zap.Error(err))
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	serviceReq := &service.Tier2Request{
		NIN: req.NIN,
	}

	if err := h.kycService.SubmitTier2(c.Request.Context(), claims.UserID, serviceReq); err != nil {
		logger.Ctx(c).Warn("Tier 2 KYC submission failed",
			zap.String("user_id", claims.UserID.String()),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Tier 2 KYC completed", zap.String("user_id", claims.UserID.String()))
	utils.SuccessResponse(c, http.StatusOK, "Tier 2 verification completed successfully", nil)
}

// SubmitTier3 processes Tier 3 KYC verification with file uploads
// @Summary Submit Tier 3 KYC
// @Description Submit NIN, selfie image file, utility bill file, and address for Tier 3 verification. Files are uploaded to Cloudinary.
// @Tags kyc
// @Accept multipart/form-data
// @Produce json
// @Security BearerAuth
// @Param nin formData string true "National Identification Number (11 digits)"
// @Param selfie_image formData file true "Selfie image file (jpg, png)"
// @Param utility_bill formData file true "Utility bill document (jpg, png, pdf)"
// @Param address_street formData string true "Street address"
// @Param address_city formData string true "City"
// @Param address_state formData string true "State"
// @Param address_country formData string true "Country"
// @Success 200 {object} utils.Response "Tier 3 verification completed successfully"
// @Failure 400 {object} utils.Response "Invalid request or verification failed"
// @Failure 401 {object} utils.Response "Authentication required"
// @Failure 422 {object} utils.Response "Validation error"
// @Router /users/me/kyc/tier3 [post]
func (h *KYCHandler) SubmitTier3(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil || claims == nil {
		logger.Ctx(c).Warn("Unauthorized access to SubmitTier3")
		utils.UnauthorizedResponse(c, "Authentication required")
		return
	}

	// The global 1 MiB MaxBytesReader applied by the router middleware is too
	// small for file uploads. Restore the original (unwrapped) request body
	// stored in the context before that middleware ran, and re-cap it at the
	// upload-specific limit. This keeps all other endpoints at 1 MiB while
	// giving this handler the headroom it needs.
	if rawBody, exists := c.Get("rawRequestBody"); exists {
		c.Request.Body = http.MaxBytesReader(c.Writer, rawBody.(io.ReadCloser), maxKYCUploadBodyBytes)
	}

	// Get form fields
	nin := strings.TrimSpace(c.PostForm("nin"))
	addressStreet := strings.TrimSpace(c.PostForm("address_street"))
	addressCity := strings.TrimSpace(c.PostForm("address_city"))
	addressState := strings.TrimSpace(c.PostForm("address_state"))
	addressCountry := strings.TrimSpace(c.PostForm("address_country"))

	// Validate required fields
	if nin == "" {
		utils.ValidationErrorResponse(c, "nin is required")
		return
	}
	if addressStreet == "" {
		utils.ValidationErrorResponse(c, "address_street is required")
		return
	}
	if addressCity == "" {
		utils.ValidationErrorResponse(c, "address_city is required")
		return
	}
	if addressState == "" {
		utils.ValidationErrorResponse(c, "address_state is required")
		return
	}
	if addressCountry == "" {
		utils.ValidationErrorResponse(c, "address_country is required")
		return
	}

	// Get selfie image file
	selfieFile, selfieHeader, err := c.Request.FormFile("selfie_image")
	if err != nil {
		utils.ValidationErrorResponse(c, "selfie_image file is required")
		return
	}
	defer selfieFile.Close()

	// Reject oversized selfies before allocating memory. selfieHeader.Size is
	// the actual parsed byte count, not a client-declared value.
	if selfieHeader.Size > maxKYCFileBytes {
		utils.ValidationErrorResponse(c, "selfie_image must not exceed 10 MB")
		return
	}

	// Validate selfie file type by extension and actual content.
	selfieExt := strings.ToLower(filepath.Ext(selfieHeader.Filename))
	if selfieExt != ".jpg" && selfieExt != ".jpeg" && selfieExt != ".png" {
		utils.ValidationErrorResponse(c, "selfie_image must be a JPG or PNG file")
		return
	}
	if !isAllowedImageMIME(selfieFile, false) {
		utils.ValidationErrorResponse(c, "selfie_image content does not match an allowed image type")
		return
	}

	// Get utility bill file
	utilityFile, utilityHeader, err := c.Request.FormFile("utility_bill")
	if err != nil {
		utils.ValidationErrorResponse(c, "utility_bill file is required")
		return
	}
	defer utilityFile.Close()

	// Reject oversized utility bills before allocating memory.
	if utilityHeader.Size > maxKYCFileBytes {
		utils.ValidationErrorResponse(c, "utility_bill must not exceed 10 MB")
		return
	}

	// Validate utility bill file type by extension and actual content.
	utilityExt := strings.ToLower(filepath.Ext(utilityHeader.Filename))
	if utilityExt != ".jpg" && utilityExt != ".jpeg" && utilityExt != ".png" && utilityExt != ".pdf" {
		utils.ValidationErrorResponse(c, "utility_bill must be a JPG, PNG, or PDF file")
		return
	}
	if !isAllowedImageMIME(utilityFile, true) {
		utils.ValidationErrorResponse(c, "utility_bill content does not match an allowed image or PDF type")
		return
	}

	ctx := c.Request.Context()

	// Read the selfie into memory and base64-encode it for Dojah.
	// io.LimitReader is defense-in-depth: even if header.Size were somehow
	// wrong, we never allocate more than maxKYCFileBytes+1 bytes here.
	selfieBytes, err := io.ReadAll(io.LimitReader(selfieFile, maxKYCFileBytes+1))
	if err != nil {
		logger.Ctx(c).Error("Failed to read selfie image in SubmitTier3", zap.String("user_id", claims.UserID.String()), zap.Error(err))
		utils.ErrorResponse(c, http.StatusBadRequest, "Failed to read selfie image", nil)
		return
	}
	if int64(len(selfieBytes)) > maxKYCFileBytes {
		utils.ValidationErrorResponse(c, "selfie_image must not exceed 10 MB")
		return
	}
	selfieBase64 := base64.StdEncoding.EncodeToString(selfieBytes)

	// Upload utility bill to Cloudinary.
	// Wrap with LimitReader so cloudinary.UploadImage (which buffers via
	// bytes.Buffer) cannot allocate more than maxKYCFileBytes in RAM.
	utilityFolder := fmt.Sprintf("%s/utility_bills", h.cloudinaryFolder)
	utilityFilename := fmt.Sprintf("user_%s_utility_bill%s", claims.UserID.String(), utilityExt)
	utilityResult, err := h.cloudinaryClient.UploadImage(ctx, io.LimitReader(utilityFile, maxKYCFileBytes+1), utilityFilename, utilityFolder)
	if err != nil {
		logger.Ctx(c).Error("Failed to upload utility bill to Cloudinary in SubmitTier3", zap.String("user_id", claims.UserID.String()), zap.Error(err))
		utils.ErrorResponse(c, http.StatusBadRequest, "Failed to upload utility bill", nil)
		return
	}

	// Create service request. SelfieBase64 is used for both liveness check and
	// NIN selfie match. Utility bill is uploaded to Cloudinary; its URL is passed
	// to Dojah for document analysis.
	serviceReq := &service.Tier3Request{
		NIN:            nin,
		SelfieBase64:   selfieBase64,
		UtilityBillURL: utilityResult.SecureURL,
		AddressStreet:  addressStreet,
		AddressCity:    addressCity,
		AddressState:   addressState,
		AddressCountry: addressCountry,
	}

	if err := h.kycService.SubmitTier3(ctx, claims.UserID, serviceReq); err != nil {
		logger.Ctx(c).Warn("Tier 3 KYC submission failed",
			zap.String("user_id", claims.UserID.String()),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusBadRequest, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Tier 3 KYC completed", zap.String("user_id", claims.UserID.String()))
	utils.SuccessResponse(c, http.StatusOK, "Tier 3 verification completed successfully", nil)
}

// isAllowedImageMIME reads the first 512 bytes of f to detect its real MIME
// type, then seeks back to the start so the caller can still read the full
// file. It returns true only for image/jpeg and image/png (and additionally
// application/pdf when allowPDF is true).
func isAllowedImageMIME(f multipart.File, allowPDF bool) bool {
	buf := make([]byte, 512)
	n, err := f.Read(buf)
	if err != nil && err != io.EOF {
		return false
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return false
	}

	mime := http.DetectContentType(buf[:n])
	switch mime {
	case "image/jpeg", "image/png":
		return true
	case "application/pdf":
		return allowPDF
	default:
		return false
	}
}

