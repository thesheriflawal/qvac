package service

import (
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
)

// ReviewService defines business logic for reviews.
type ReviewService interface {
	CreateReview(name, email, content string) (*models.Review, error)
	ListReviews(page, pageSize int) ([]models.Review, int64, error)
}

type reviewService struct {
	repo repository.ReviewRepository
}

// NewReviewService creates a new review service.
func NewReviewService(repo repository.ReviewRepository) ReviewService {
	return &reviewService{repo: repo}
}

func (s *reviewService) CreateReview(name, email, content string) (*models.Review, error) {
	name = strings.TrimSpace(name)
	email = strings.TrimSpace(email)
	content = strings.TrimSpace(content)

	if name == "" {
		return nil, utils.NewSafeError("name is required")
	}
	if email == "" {
		return nil, utils.NewSafeError("email is required")
	}
	if content == "" {
		return nil, utils.NewSafeError("review content is required")
	}

	review := &models.Review{
		Name:    name,
		Email:   email,
		Content: content,
	}

	if err := s.repo.Create(review); err != nil {
		return nil, err
	}

	return review, nil
}

func (s *reviewService) ListReviews(page, pageSize int) ([]models.Review, int64, error) {
	return s.repo.ListAll(page, pageSize)
}
