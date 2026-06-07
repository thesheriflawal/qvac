package handler

import (
	"net/http"
	"strconv"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"go.uber.org/zap"
)

// ReviewHandler handles HTTP requests related to reviews.
type ReviewHandler struct {
	reviewService service.ReviewService
}

// NewReviewHandler creates a new ReviewHandler.
func NewReviewHandler(reviewService service.ReviewService) *ReviewHandler {
	return &ReviewHandler{reviewService: reviewService}
}

// SubmitReviewRequest represents the request body for submitting a review.
type SubmitReviewRequest struct {
	Name    string `json:"name" validate:"required,min=2,max=255"`
	Email   string `json:"email" validate:"required,email"`
	Content string `json:"content" validate:"required,min=1"`
}

// SubmitReview creates a new review.
// @Summary Submit a review
// @Description Submit a review with name, email and content
// @Tags reviews
// @Accept json
// @Produce json
// @Param request body SubmitReviewRequest true "Review details"
// @Success 201 {object} utils.Response{data=models.ReviewResponse} "Review submitted successfully"
// @Failure 400 {object} utils.Response "Validation error"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /reviews [post]
func (h *ReviewHandler) SubmitReview(c *gin.Context) {
	var req SubmitReviewRequest

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

	review, err := h.reviewService.CreateReview(req.Name, req.Email, req.Content)
	if err != nil {
		logger.Ctx(c).Error("Failed to create review", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusCreated, "Review submitted successfully", review.ToResponse())
}

// ListReviews returns paginated reviews.
// @Summary List reviews
// @Description Get a paginated list of all reviews
// @Tags reviews
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Items per page" default(10)
// @Success 200 {object} utils.PaginatedResponse{data=[]models.ReviewResponse} "Reviews retrieved successfully"
// @Failure 500 {object} utils.Response "Internal server error"
// @Router /reviews [get]
func (h *ReviewHandler) ListReviews(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	reviews, total, err := h.reviewService.ListReviews(page, pageSize)
	if err != nil {
		logger.Ctx(c).Error("Failed to list reviews", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	resp := make([]*models.ReviewResponse, len(reviews))
	for i := range reviews {
		resp[i] = reviews[i].ToResponse()
	}

	pagination := utils.CalculatePagination(page, pageSize, total)
	utils.PaginatedSuccessResponse(c, http.StatusOK, "Reviews retrieved successfully", resp, pagination)
}
