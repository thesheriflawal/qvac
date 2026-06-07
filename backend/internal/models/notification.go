package models

import (
	"time"

	"github.com/google/uuid"
)

// Notification represents an in-app notification for a user.
type Notification struct {
	BaseModel

	UserID  uuid.UUID  `gorm:"type:uuid;index;not null" json:"user_id"`
	Title   string     `gorm:"size:255;not null" json:"title"`
	Message string     `gorm:"type:text;not null" json:"message"`
	IsRead  bool       `gorm:"default:false;not null" json:"is_read"`
	ReadAt  *time.Time `json:"read_at,omitempty"`
}

// TableName specifies the table name for Notification model.
func (Notification) TableName() string {
	return "notifications"
}

// NotificationSetting represents a user's notification preferences.
type NotificationSetting struct {
	BaseModel
	UserID  uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	AppPush bool `gorm:"default:true" json:"app_push"`
	Email   bool `gorm:"default:true" json:"email"`
	SMS     bool `gorm:"default:false" json:"sms"`
}

// TableName specifies the table name for NotificationSetting model.
func (NotificationSetting) TableName() string {
	return "notification_settings"
}

// NotificationResponse represents the notification data returned in API responses.
type NotificationResponse struct {
	ID        uuid.UUID  `json:"id"`
	Title     string     `json:"title"`
	Message   string     `json:"message"`
	IsRead    bool       `json:"is_read"`
	ReadAt    *time.Time `json:"read_at,omitempty"`
	CreatedAt string     `json:"created_at"`
}

// ToResponse converts Notification model to NotificationResponse.
func (n *Notification) ToResponse() *NotificationResponse {
	var readAt *time.Time
	if n.ReadAt != nil {
		utc := n.ReadAt.UTC()
		readAt = &utc
	}

	return &NotificationResponse{
		ID:        n.ID,
		Title:     n.Title,
		Message:   n.Message,
		IsRead:    n.IsRead,
		ReadAt:    readAt,
		CreatedAt: n.CreatedAt.Format(time.RFC3339),
	}
}
