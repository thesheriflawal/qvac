package models

// CommunityLink stores a platform community URL (e.g. Telegram, Discord).
// Admin can upsert links by platform name; any authenticated user can read them.
type CommunityLink struct {
	BaseModel
	Platform string `gorm:"uniqueIndex;not null" json:"platform"`
	URL      string `gorm:"not null"            json:"url"`
	Label    string `json:"label"`
}
