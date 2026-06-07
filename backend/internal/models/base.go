package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BaseModel contains common fields for all models
type BaseModel struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate hook to set timestamps and generate UUID if not set
func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	now := time.Now().UTC()
	b.CreatedAt = now
	b.UpdatedAt = now
	return nil
}

// BeforeUpdate hook to update timestamp
func (b *BaseModel) BeforeUpdate(tx *gorm.DB) error {
	b.UpdatedAt = time.Now().UTC()
	return nil
}
