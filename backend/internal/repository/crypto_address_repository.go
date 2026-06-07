package repository

import (
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CryptoAddressRepository interface {
	FindByUserNetworkCurrency(userID uuid.UUID, networkID uuid.UUID, currencyID uuid.UUID) (*models.CryptoAddress, error)
	FindAnyByUserNetwork(userID uuid.UUID, networkID uuid.UUID) (*models.CryptoAddress, error)
	Create(addr *models.CryptoAddress) error
}

type cryptoAddressRepository struct {
	db *gorm.DB
}

func NewCryptoAddressRepository(db *gorm.DB) CryptoAddressRepository {
	return &cryptoAddressRepository{db: db}
}

func (r *cryptoAddressRepository) FindByUserNetworkCurrency(userID uuid.UUID, networkID uuid.UUID, currencyID uuid.UUID) (*models.CryptoAddress, error) {
	var addr models.CryptoAddress
	if err := r.db.Where("user_id = ? AND network_id = ? AND currency_id = ?", userID, networkID, currencyID).First(&addr).Error; err != nil {
		return nil, err
	}
	return &addr, nil
}

func (r *cryptoAddressRepository) FindAnyByUserNetwork(userID uuid.UUID, networkID uuid.UUID) (*models.CryptoAddress, error) {
	var addr models.CryptoAddress
	if err := r.db.Where("user_id = ? AND network_id = ?", userID, networkID).First(&addr).Error; err != nil {
		return nil, err
	}
	return &addr, nil
}

func (r *cryptoAddressRepository) Create(addr *models.CryptoAddress) error {
	return r.db.Create(addr).Error
}
