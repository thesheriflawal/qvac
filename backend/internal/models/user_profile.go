package models

import (
	"time"

	"github.com/google/uuid"
)

// UserProfile represents the profile information for a user
type UserProfile struct {
	BaseModel
	UserID    uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	FullName  string `json:"full_name"`
	Username  string `gorm:"uniqueIndex" json:"username"`
	AvatarURL string `json:"avatar_url"`
	Country   string `json:"country"`

	// KYC-related profile fields
	FirstName            string     `gorm:"size:100" json:"first_name"`
	LastName             string     `gorm:"size:100" json:"last_name"`
	MiddleName           string     `gorm:"size:100" json:"middle_name"`
	DateOfBirth          *time.Time `json:"date_of_birth"`
	PhoneNumber          string     `gorm:"size:20" json:"phone_number"`
	DisplayUsernameOnP2P bool       `gorm:"default:false" json:"display_username_on_p2p"`
}

// TableName specifies the table name for UserProfile model
func (UserProfile) TableName() string {
	return "user_profiles"
}
