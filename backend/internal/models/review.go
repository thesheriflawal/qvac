package models

import (
	"time"

	"github.com/google/uuid"
)

// Review represents a user-submitted review.
type Review struct {
	BaseModel

	Name    string `gorm:"size:255;not null" json:"name"`
	Email   string `gorm:"size:255;not null" json:"email"`
	Content string `gorm:"type:text;not null" json:"content"`
}

// TableName specifies the table name for Review model.
func (Review) TableName() string {
	return "reviews"
}

// ReviewResponse represents the review data returned in API responses.
type ReviewResponse struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Content   string    `json:"content"`
	CreatedAt string    `json:"created_at"`
}

// ToResponse converts Review model to ReviewResponse.
func (r *Review) ToResponse() *ReviewResponse {
	return &ReviewResponse{
		ID:        r.ID,
		Name:      r.Name,
		Email:     r.Email,
		Content:   r.Content,
		CreatedAt: r.CreatedAt.Format(time.RFC3339),
	}
}
