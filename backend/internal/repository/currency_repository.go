package repository

import (
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CurrencyRepository interface {
	FindBySymbol(symbol string) (*models.Currency, error)
	FindByID(id uuid.UUID) (*models.Currency, error)
	List() ([]models.Currency, error)
	Upsert(currency *models.Currency) error
}

type currencyRepository struct {
	db *gorm.DB
}

func NewCurrencyRepository(db *gorm.DB) CurrencyRepository {
	return &currencyRepository{db: db}
}

func (r *currencyRepository) FindBySymbol(symbol string) (*models.Currency, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))
	var c models.Currency
	if err := r.db.Where("symbol = ?", symbol).First(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *currencyRepository) FindByID(id uuid.UUID) (*models.Currency, error) {
	var c models.Currency
	if err := r.db.First(&c, id).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *currencyRepository) List() ([]models.Currency, error) {
	var out []models.Currency
	if err := r.db.Order("id asc").Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

// Upsert uses symbol as the natural key.
func (r *currencyRepository) Upsert(currency *models.Currency) error {
	currency.Symbol = strings.ToUpper(strings.TrimSpace(currency.Symbol))
	return r.db.Where("symbol = ?", currency.Symbol).
		Assign(currency).
		FirstOrCreate(currency).Error
}
