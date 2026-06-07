package handler

import (
	"net/http"
	"strconv"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)


// AdminKYCHandler handles admin KYC queue endpoints.
type AdminKYCHandler struct {
	adminKYCService service.AdminKYCService
}

// NewAdminKYCHandler creates a new AdminKYCHandler.
func NewAdminKYCHandler(svc service.AdminKYCService) *AdminKYCHandler {
	return &AdminKYCHandler{adminKYCService: svc}
}

// kycQueueItem is the response shape for each record in the KYC list.
type kycQueueItem struct {
	UserID              uuid.UUID              `json:"user_id"`
	Email               string                 `json:"email"`
	UID                 string                 `json:"uid"`
	FullName            string                 `json:"full_name"`
	PhoneNumber         string                 `json:"phone_number"`
	Tier                models.KYCTier         `json:"tier"`
	Status              models.KYCStatus       `json:"status"`
	BVNVerified         bool                   `json:"bvn_verified"`
	NINVerified         bool                   `json:"nin_verified"`
	SelfieVerified      bool                   `json:"selfie_verified"`
	AddressVerified     bool                   `json:"address_verified"`
	SelfieConfidence    float64                `json:"selfie_confidence,omitempty"`
	LivenessProbability float64                `json:"liveness_probability,omitempty"`
	RejectionReason     string                 `json:"rejection_reason,omitempty"`
	UpdatedAt           string                 `json:"updated_at"`
}

// kycDetailResponse is the full admin KYC detail response.
type kycDetailResponse struct {
	UserID              uuid.UUID        `json:"user_id"`
	Email               string           `json:"email"`
	UID                 string           `json:"uid"`
	FullName            string           `json:"full_name"`
	PhoneNumber         string           `json:"phone_number"`
	Tier                models.KYCTier   `json:"tier"`
	Status              models.KYCStatus `json:"status"`
	BVNVerified         bool             `json:"bvn_verified"`
	NINVerified         bool             `json:"nin_verified"`
	SelfieVerified      bool             `json:"selfie_verified"`
	AddressVerified     bool             `json:"address_verified"`
	SelfieConfidence    float64          `json:"selfie_confidence,omitempty"`
	LivenessProbability float64          `json:"liveness_probability,omitempty"`
	AddressStreet       string           `json:"address_street,omitempty"`
	AddressCity         string           `json:"address_city,omitempty"`
	AddressState        string           `json:"address_state,omitempty"`
	AddressCountry      string           `json:"address_country,omitempty"`
	RejectionReason     string           `json:"rejection_reason,omitempty"`
	CreatedAt           string           `json:"created_at"`
	UpdatedAt           string           `json:"updated_at"`
}

func kycToQueueItem(k models.KYCVerification) kycQueueItem {
	fullName := k.User.FirstName + " " + k.User.LastName
	phone := ""
	if k.User.Profile.UserID != uuid.Nil {
		if k.User.Profile.FirstName != "" {
			fullName = k.User.Profile.FirstName + " " + k.User.Profile.LastName
		}
		phone = k.User.Profile.PhoneNumber
	}
	return kycQueueItem{
		UserID:              k.UserID,
		Email:               k.User.Email,
		UID:                 k.User.UID,
		FullName:            fullName,
		PhoneNumber:         phone,
		Tier:                k.Tier,
		Status:              k.Status,
		BVNVerified:         k.IsBVNVerified(),
		NINVerified:         k.IsNINVerified(),
		SelfieVerified:      k.IsSelfieVerified(),
		AddressVerified:     k.IsAddressVerified(),
		SelfieConfidence:    k.SelfieConfidenceValue,
		LivenessProbability: k.LivenessProbability,
		RejectionReason:     k.RejectionReason,
		UpdatedAt:           k.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func kycToDetail(k *models.KYCVerification) kycDetailResponse {
	fullName := k.User.FirstName + " " + k.User.LastName
	phone := ""
	if k.User.Profile.UserID != uuid.Nil {
		if k.User.Profile.FirstName != "" {
			fullName = k.User.Profile.FirstName + " " + k.User.Profile.LastName
		}
		phone = k.User.Profile.PhoneNumber
	}
	return kycDetailResponse{
		UserID:              k.UserID,
		Email:               k.User.Email,
		UID:                 k.User.UID,
		FullName:            fullName,
		PhoneNumber:         phone,
		Tier:                k.Tier,
		Status:              k.Status,
		BVNVerified:         k.IsBVNVerified(),
		NINVerified:         k.IsNINVerified(),
		SelfieVerified:      k.IsSelfieVerified(),
		AddressVerified:     k.IsAddressVerified(),
		SelfieConfidence:    k.SelfieConfidenceValue,
		LivenessProbability: k.LivenessProbability,
		AddressStreet:       k.AddressStreet,
		AddressCity:         k.AddressCity,
		AddressState:        k.AddressState,
		AddressCountry:      k.AddressCountry,
		RejectionReason:     k.RejectionReason,
		CreatedAt:           k.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:           k.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// ListKYCVerifications returns a paginated, filterable list of KYC records.
// @Summary List KYC verifications (admin)
// @Description Admin-only: paginated KYC queue with optional filters by status and tier.
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param page      query int    false "Page number (default 1)"
// @Param page_size query int    false "Page size (default 10, max 100)"
// @Param status    query string false "Filter by status: pending, verified, rejected"
// @Param tier      query int    false "Filter by tier: 0, 1, 2, 3"
// @Success 200 {object} utils.PaginatedResponse
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Router /admin/kyc [get]
func (h *AdminKYCHandler) ListKYCVerifications(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	var filters repository.KYCListFilters

	if v := c.Query("status"); v != "" {
		s := models.KYCStatus(v)
		filters.Status = &s
	}
	if v := c.Query("tier"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			t := models.KYCTier(n)
			filters.Tier = &t
		}
	}

	records, total, err := h.adminKYCService.ListVerifications(filters, page, pageSize)
	if err != nil {
		logger.Ctx(c).Error("Admin ListKYCVerifications failed", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	items := make([]kycQueueItem, len(records))
	for i, r := range records {
		items[i] = kycToQueueItem(r)
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "KYC verifications retrieved successfully", items, pagination)
}

// GetKYCVerification returns the full KYC detail for a user.
// @Summary Get KYC verification detail (admin)
// @Description Admin-only: full KYC record for a user including address, selfie confidence, liveness score.
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param user_id path string true "User UUID"
// @Success 200 {object} utils.Response
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Failure 404 {object} utils.Response
// @Router /admin/kyc/{user_id} [get]
func (h *AdminKYCHandler) GetKYCVerification(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		utils.ValidationErrorResponse(c, "invalid user_id")
		return
	}

	kyc, err := h.adminKYCService.GetVerification(userID)
	if err != nil {
		if err.Error() == "KYC record not found" {
			utils.ErrorResponse(c, http.StatusNotFound, "KYC record not found", nil)
			return
		}
		logger.Ctx(c).Error("Admin GetKYCVerification failed", zap.String("user_id", userID.String()), zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "KYC verification retrieved successfully", kycToDetail(kyc))
}

