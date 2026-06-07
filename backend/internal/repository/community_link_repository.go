package repository

import (
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CommunityLinkRepository interface {
	Upsert(link *models.CommunityLink) error
	ListAll() ([]models.CommunityLink, error)
}

type communityLinkRepository struct {
	db *gorm.DB
}

func NewCommunityLinkRepository(db *gorm.DB) CommunityLinkRepository {
	return &communityLinkRepository{db: db}
}

func (r *communityLinkRepository) Upsert(link *models.CommunityLink) error {
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "platform"}},
		DoUpdates: clause.AssignmentColumns([]string{"url", "label", "updated_at"}),
	}).Create(link).Error
}

func (r *communityLinkRepository) ListAll() ([]models.CommunityLink, error) {
	var links []models.CommunityLink
	err := r.db.Order("platform asc").Find(&links).Error
	return links, err
}
