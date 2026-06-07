package repository

import (
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BankAccountRepository handles persistence of user bank account details.
type BankAccountRepository interface {
	// FindByUserID returns the most recent bank account record for a user.
	FindByUserID(userID uuid.UUID) (*models.BankAccount, error)

	// Create inserts a new bank account record.
	Create(acct *models.BankAccount) error
}

type bankAccountRepository struct {
	db *gorm.DB
}

// NewBankAccountRepository creates a new BankAccountRepository.
func NewBankAccountRepository(db *gorm.DB) BankAccountRepository {
	return &bankAccountRepository{db: db}
}

func (r *bankAccountRepository) FindByUserID(userID uuid.UUID) (*models.BankAccount, error) {
	var acct models.BankAccount
	if err := r.db.Where("user_id = ?", userID).Order("id DESC").First(&acct).Error; err != nil {
		return nil, err
	}
	return &acct, nil
}

func (r *bankAccountRepository) Create(acct *models.BankAccount) error {
	return r.db.Create(acct).Error
}
