package repository

import (
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type NetworkRepository interface {
	FindActiveByChainKeyNetworkType(chainKey, networkType string) (*models.Network, error)
	ListActive() ([]models.Network, error)
	ListByCurrency(currencyID uuid.UUID) ([]models.Network, error)
	Upsert(network *models.Network) error
	CurrencyExistsOnNetwork(currencyID, networkID uuid.UUID) (bool, error)
}

type networkRepository struct {
	db *gorm.DB
}

func NewNetworkRepository(db *gorm.DB) NetworkRepository {
	return &networkRepository{db: db}
}

func (r *networkRepository) FindActiveByChainKeyNetworkType(chainKey, networkType string) (*models.Network, error) {
	chainKey = strings.ToLower(strings.TrimSpace(chainKey))
	networkType = strings.ToLower(strings.TrimSpace(networkType))

	var n models.Network
	err := r.db.Where("chain_key = ? AND network_type = ? AND is_active = ?", chainKey, networkType, true).First(&n).Error
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *networkRepository) ListActive() ([]models.Network, error) {
	var out []models.Network
	if err := r.db.Where("is_active = ?", true).Order("id asc").Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

func (r *networkRepository) ListByCurrency(currencyID uuid.UUID) ([]models.Network, error) {
	var out []models.Network
	err := r.db.Joins("JOIN currency_networks cn ON cn.network_id = networks.id").
		Where("cn.currency_id = ? AND networks.is_active = ?", currencyID, true).
		Order("networks.name asc").
		Find(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

// Upsert uses (chain_key, network_type) as the natural key.
func (r *networkRepository) Upsert(network *models.Network) error {
	return r.db.Where("chain_key = ? AND network_type = ?", network.ChainKey, network.NetworkType).
		Assign(network).
		FirstOrCreate(network).Error
}


func (r *networkRepository) CurrencyExistsOnNetwork(currencyID, networkID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.Table("currency_networks").
		Where("currency_id = ? AND network_id = ?", currencyID, networkID).
		Count(&count).Error

	println("CurrencyExistsOnNetwork query error:", err) // Debugging log
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
