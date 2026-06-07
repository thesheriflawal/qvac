package repository

import (
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"gorm.io/gorm"
)

// ReviewRepository handles review data operations.
type ReviewRepository interface {
	Create(review *models.Review) error
	ListAll(page, pageSize int) ([]models.Review, int64, error)
}

type reviewRepository struct {
	db *gorm.DB
}

// NewReviewRepository creates a new review repository.
func NewReviewRepository(db *gorm.DB) ReviewRepository {
	return &reviewRepository{db: db}
}

// Create stores a new review.
func (r *reviewRepository) Create(review *models.Review) error {
	return r.db.Create(review).Error
}

// ListAll returns paginated reviews ordered by newest first.
func (r *reviewRepository) ListAll(page, pageSize int) ([]models.Review, int64, error) {
	var reviews []models.Review
	var total int64

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	if err := r.db.Model(&models.Review{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&reviews).Error; err != nil {
		return nil, 0, err
	}

	return reviews, total, nil
}
