package models

import (
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserRole represents user roles in the system
type UserRole string

const (
	RoleUser  UserRole = "user"
	RoleAdmin UserRole = "admin"
)

// User represents a user in the system
type User struct {
	BaseModel

	// UID is a 14-digit numeric identifier that can be used for internal transfers and
	// external references. It is separate from the auto-incrementing primary key.
	UID string `gorm:"size:14;uniqueIndex;not null" json:"uid"`

	Email    string `gorm:"uniqueIndex;not null" json:"email" validate:"required,email"`
	Password string `gorm:"column:password;not null" json:"-" validate:"required,min=6"`

	// Names are collected later during verification; allow them to be empty initially.
	FirstName string `gorm:"default:''" json:"first_name" validate:"omitempty,min=2"`
	LastName  string `gorm:"default:''" json:"last_name" validate:"omitempty,min=2"`

	// json:"-" prevents these fields from being set via JSON binding (mass assignment
	// protection). API responses always go through ToResponse() / UserResponse which
	// has its own Role and IsActive fields, so output is unaffected.
	Role     UserRole `gorm:"type:varchar(20);default:'user'" json:"-"`
	IsActive bool     `gorm:"default:true" json:"-"`

	ReferralCode string `gorm:"size:6;uniqueIndex" json:"referral_code"`

	// QuidaxUserID is the Quidax sub-account ID for this user, created on demand.
	// Kept internal — never exposed or accepted via the public API.
	QuidaxUserID       string `gorm:"column:quidax_user_id;index" json:"-"`
	QuidaxSubAccountSN string `gorm:"column:quidax_sub_account_sn;index" json:"-"`

	// Relationships
	Profile                   UserProfile         `json:"profile" gorm:"foreignKey:UserID"`
	Security                  UserSecurity        `json:"security" gorm:"foreignKey:UserID"`
	Wallets                   []Wallet            `json:"wallets" gorm:"foreignKey:UserID"`
	P2PAds                    []P2PAd             `json:"p2p_ads" gorm:"foreignKey:UserID"`
	P2POrdersAsBuyer          []P2POrder          `json:"p2p_orders_as_buyer" gorm:"foreignKey:BuyerID"`
	P2POrdersAsSeller         []P2POrder          `json:"p2p_orders_as_seller" gorm:"foreignKey:SellerID"`
	CryptoDeposits            []CryptoDeposit     `json:"crypto_deposits" gorm:"foreignKey:UserID"`
	CryptoWithdrawals         []CryptoWithdrawal  `json:"crypto_withdrawals" gorm:"foreignKey:UserID"`
	FiatDeposits              []FiatDeposit       `json:"fiat_deposits" gorm:"foreignKey:UserID"`
	FiatWithdrawals           []FiatWithdrawal    `json:"fiat_withdrawals" gorm:"foreignKey:UserID"`
	InternalTransfersSent     []InternalTransfer  `json:"internal_transfers_sent" gorm:"foreignKey:SenderID"`
	InternalTransfersReceived []InternalTransfer  `json:"internal_transfers_received" gorm:"foreignKey:ReceiverID"`
	NotificationSettings      NotificationSetting `json:"notification_settings" gorm:"foreignKey:UserID"`
	BankAccounts              []BankAccount       `json:"bank_accounts" gorm:"foreignKey:UserID"`
	CryptoAddresses           []CryptoAddress     `json:"crypto_addresses" gorm:"foreignKey:UserID"`
}

// TableName specifies the table name for User model
func (User) TableName() string {
	return "users"
}

// BeforeCreate hook to hash password before creating user
func (u *User) BeforeCreate(tx *gorm.DB) error {
	// Call base model hook
	if err := u.BaseModel.BeforeCreate(tx); err != nil {
		return err
	}

	// Ensure UID is set (14-digit numeric). We generate it here to decouple
	// external identifiers from the internal auto-incrementing ID.
	if strings.TrimSpace(u.UID) == "" {
		uid, err := utils.Generate14DigitUID()
		if err != nil {
			return err
		}
		u.UID = uid
	}

	// Ensure referral code is set.
	if strings.TrimSpace(u.ReferralCode) == "" {
		code, err := utils.GenerateReferralCode()
		if err != nil {
			return err
		}
		u.ReferralCode = code
	}

	// Trim whitespace from name fields.
	u.FirstName = strings.TrimSpace(u.FirstName)
	u.LastName = strings.TrimSpace(u.LastName)

	// Always hash the password. User-supplied input is always plaintext;
	// storing a pre-computed hash as the password field is never valid.
	if u.Password != "" {
		hashedPassword, err := utils.HashPassword(u.Password)
		if err != nil {
			return err
		}
		u.Password = hashedPassword
	}

	// Set default role if not specified
	if u.Role == "" {
		u.Role = RoleUser
	}

	return nil
}

// BeforeUpdate hook to hash password before updating user
func (u *User) BeforeUpdate(tx *gorm.DB) error {
	// Call base model hook
	if err := u.BaseModel.BeforeUpdate(tx); err != nil {
		return err
	}

	// Trim whitespace from name fields.
	u.FirstName = strings.TrimSpace(u.FirstName)
	u.LastName = strings.TrimSpace(u.LastName)

	// Hash the password if it's plaintext. We avoid relying solely on tx.Statement.Changed
	// because db.Save() does not track field changes accurately when the struct is modified in memory.
	if u.Password != "" && !utils.IsPreHashedPassword(u.Password) && !strings.HasPrefix(u.Password, "$2") {
		hashedPassword, err := utils.HashPassword(u.Password)
		if err != nil {
			return err
		}
		u.Password = hashedPassword
	}

	return nil
}

// UserResponse represents the user data returned in API responses
type UserResponse struct {
	ID           uuid.UUID `json:"id"`
	UID          string    `json:"uid"`
	Email        string    `json:"email"`
	Username     string    `json:"username"`
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	Role         UserRole  `json:"role"`
	IsActive     bool      `json:"is_active"`
	ReferralCode string    `json:"referral_code"`
	Is2FAEnabled bool      `json:"is_2fa_enabled"`
	IsPINEnabled bool      `json:"is_pin_enabled"`
	CreatedAt    string    `json:"created_at"`
	UpdatedAt    string    `json:"updated_at"`
}

// ToResponse converts User model to UserResponse.
// The Security association must be preloaded for Is2FAEnabled and IsPINEnabled to be accurate.
func (u *User) ToResponse() *UserResponse {
	return &UserResponse{
		ID:           u.ID,
		UID:          u.UID,
		Email:        u.Email,
		Username:     u.Profile.Username,
		FirstName:    u.FirstName,
		LastName:     u.LastName,
		Role:         u.Role,
		IsActive:     u.IsActive,
		ReferralCode: u.ReferralCode,
		Is2FAEnabled: u.Security.TwoFAEnabled,
		IsPINEnabled: u.Security.PinEnabled,
		CreatedAt:    u.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:    u.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// IsAdmin checks if user has admin role
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}
