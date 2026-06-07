package service

import (
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
)

// NotificationService defines business logic for notifications.
type NotificationService interface {
	ListUserNotifications(userID uuid.UUID, status string, page, pageSize int) ([]models.Notification, int64, error)
	MarkNotificationRead(userID, notificationID uuid.UUID) error
	MarkAllNotificationsRead(userID uuid.UUID) (int64, error)
	CreateNotificationForUser(userID uuid.UUID, title, message string) (*models.Notification, error)
	BroadcastNotification(title, message string) error
}

type notificationService struct {
	repo repository.NotificationRepository
}

// NewNotificationService creates a new notification service.
func NewNotificationService(repo repository.NotificationRepository) NotificationService {
	return &notificationService{repo: repo}
}

func (s *notificationService) ListUserNotifications(userID uuid.UUID, status string, page, pageSize int) ([]models.Notification, int64, error) {
	onlyUnread := false
	if strings.ToLower(strings.TrimSpace(status)) == "unread" {
		onlyUnread = true
	}
	return s.repo.ListByUser(userID, onlyUnread, page, pageSize)
}

func (s *notificationService) MarkNotificationRead(userID, notificationID uuid.UUID) error {
	return s.repo.MarkRead(userID, notificationID)
}

func (s *notificationService) MarkAllNotificationsRead(userID uuid.UUID) (int64, error) {
	return s.repo.MarkAllRead(userID)
}

func validateNotificationPayload(title, message string) error {
	if strings.TrimSpace(title) == "" {
		return utils.NewSafeError("title is required")
	}
	if strings.TrimSpace(message) == "" {
		return utils.NewSafeError("message is required")
	}
	return nil
}

func (s *notificationService) CreateNotificationForUser(userID uuid.UUID, title, message string) (*models.Notification, error) {
	if err := validateNotificationPayload(title, message); err != nil {
		return nil, err
	}

	n := &models.Notification{
		UserID:  userID,
		Title:   strings.TrimSpace(title),
		Message: strings.TrimSpace(message),
	}

	if err := s.repo.Create(n); err != nil {
		return nil, err
	}

	return n, nil
}

func (s *notificationService) BroadcastNotification(title, message string) error {
	if err := validateNotificationPayload(title, message); err != nil {
		return err
	}

	return s.repo.BroadcastToAllUsers(strings.TrimSpace(title), strings.TrimSpace(message))
}
