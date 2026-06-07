package repository

import (
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AdminUserFilters holds optional filter criteria for admin user search.
// Nil pointer fields are ignored (not applied to the query).
type AdminUserFilters struct {
	Email    string
	UID      string
	KYCTier  *models.KYCTier
	IsActive *bool
	Has2FA   *bool
}

// UserRepository handles user data operations
type UserRepository interface {
	Create(user *models.User) error
	FindByID(id uuid.UUID) (*models.User, error)
	FindByEmail(email string) (*models.User, error)
	FindByUID(uid string) (*models.User, error)
	Update(user *models.User) error
	Delete(id uuid.UUID) error
	List(page, pageSize int) ([]models.User, int64, error)
	ExistsByEmail(email string) (bool, error)
	// Admin-specific methods
	SearchUsers(filters AdminUserFilters, page, pageSize int) ([]models.User, int64, error)
	FindByIDWithAdminDetail(id uuid.UUID) (*models.User, error)
	SetActiveStatus(id uuid.UUID, isActive bool) error
}

type userRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

// Create creates a new user
func (r *userRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

// FindByID finds a user by ID, preloading Security and Profile so callers can read 2FA state and username.
func (r *userRepository) FindByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.Preload("Security").Preload("Profile").First(&user, id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByEmail finds a user by email, preloading Security so callers can read 2FA state.
func (r *userRepository) FindByEmail(email string) (*models.User, error) {
	var user models.User
	err := r.db.Preload("Security").Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByUID finds a user by UID
func (r *userRepository) FindByUID(uid string) (*models.User, error) {
	var user models.User
	err := r.db.Where("uid = ?", uid).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// Update updates a user
func (r *userRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

// Delete soft deletes a user
func (r *userRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.User{}, id).Error
}

// List returns a paginated list of users
func (r *userRepository) List(page, pageSize int) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	// Count total users
	if err := r.db.Model(&models.User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Get paginated users
	offset := (page - 1) * pageSize
	err := r.db.Offset(offset).Limit(pageSize).Find(&users).Error
	if err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// ExistsByEmail checks if a user with the given email exists
func (r *userRepository) ExistsByEmail(email string) (bool, error) {
	var count int64
	err := r.db.Model(&models.User{}).Where("email = ?", email).Count(&count).Error
	return count > 0, err
}

// SearchUsers returns a paginated, filtered list of users for admin use.
func (r *userRepository) SearchUsers(filters AdminUserFilters, page, pageSize int) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	q := r.db.Model(&models.User{})

	// Conditionally join user_security when filtering by 2FA status.
	if filters.Has2FA != nil {
		q = q.Joins("LEFT JOIN user_security ON user_security.user_id = users.id AND user_security.deleted_at IS NULL").
			Where("user_security.twofa_enabled = ?", *filters.Has2FA)
	}

	// Conditionally join kyc_verifications when filtering by KYC tier.
	if filters.KYCTier != nil {
		q = q.Joins("LEFT JOIN kyc_verifications ON kyc_verifications.user_id = users.id AND kyc_verifications.deleted_at IS NULL").
			Where("kyc_verifications.tier = ?", *filters.KYCTier)
	}

	if filters.Email != "" {
		q = q.Where("users.email ILIKE ?", "%"+filters.Email+"%")
	}
	if filters.UID != "" {
		q = q.Where("users.uid = ?", filters.UID)
	}
	if filters.IsActive != nil {
		q = q.Where("users.is_active = ?", *filters.IsActive)
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := q.Preload("Security").
		Order("users.created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// FindByIDWithAdminDetail fetches a user with Profile, Security, and Wallets preloaded.
func (r *userRepository) FindByIDWithAdminDetail(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.Preload("Profile").Preload("Security").Preload("Wallets").Preload("Wallets.CurrencyRef").
		First(&user, id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// SetActiveStatus updates the is_active flag for a user.
func (r *userRepository) SetActiveStatus(id uuid.UUID, isActive bool) error {
	result := r.db.Model(&models.User{}).Where("id = ?", id).Update("is_active", isActive)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
