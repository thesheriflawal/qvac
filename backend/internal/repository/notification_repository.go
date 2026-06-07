package repository

import (
	"fmt"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// NotificationRepository handles notification data operations.
type NotificationRepository interface {
	Create(notification *models.Notification) error
	ListByUser(userID uuid.UUID, onlyUnread bool, page, pageSize int) ([]models.Notification, int64, error)
	MarkRead(userID, notificationID uuid.UUID) error
	MarkAllRead(userID uuid.UUID) (int64, error)
	BroadcastToAllUsers(title, message string) error
}

type notificationRepository struct {
	db *gorm.DB
}

// NewNotificationRepository creates a new notification repository.
func NewNotificationRepository(db *gorm.DB) NotificationRepository {
	return &notificationRepository{db: db}
}

// Create stores a new notification.
func (r *notificationRepository) Create(notification *models.Notification) error {
	return r.db.Create(notification).Error
}

// ListByUser returns paginated notifications for a user.
func (r *notificationRepository) ListByUser(userID uuid.UUID, onlyUnread bool, page, pageSize int) ([]models.Notification, int64, error) {
	var notifications []models.Notification
	var total int64

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	query := r.db.Model(&models.Notification{}).Where("user_id = ?", userID)
	if onlyUnread {
		query = query.Where("is_read = ?", false)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&notifications).Error; err != nil {
		return nil, 0, err
	}

	return notifications, total, nil
}

// MarkRead marks a single notification as read for a user.
func (r *notificationRepository) MarkRead(userID, notificationID uuid.UUID) error {
	now := time.Now().UTC()

	res := r.db.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", notificationID, userID).
		Where("is_read = ?", false).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": &now,
		})

	if res.Error != nil {
		return res.Error
	}

	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}

	return nil
}

// MarkAllRead marks all unread notifications for a user as read.
func (r *notificationRepository) MarkAllRead(userID uuid.UUID) (int64, error) {
	now := time.Now().UTC()

	res := r.db.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": &now,
		})

	if res.Error != nil {
		return 0, res.Error
	}

	return res.RowsAffected, nil
}

// BroadcastToAllUsers creates a notification for every active user.
func (r *notificationRepository) BroadcastToAllUsers(title, message string) error {
	now := time.Now().UTC()

	notificationTable := (&models.Notification{}).TableName()
	userTable := (models.User{}).TableName()

	sql := fmt.Sprintf(`
		INSERT INTO %s (user_id, title, message, is_read, read_at, created_at, updated_at, deleted_at)
		SELECT id, ?, ?, false, NULL, ?, ?, NULL
		FROM %s
		WHERE deleted_at IS NULL
	`, notificationTable, userTable)

	return r.db.Exec(sql, title, message, now, now).Error
}
