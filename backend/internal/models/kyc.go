package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// KYCTier represents the KYC verification tier level
type KYCTier int

const (
	KYCTierNone KYCTier = 0
	KYCTier1    KYCTier = 1
	KYCTier2    KYCTier = 2
	KYCTier3    KYCTier = 3
)

// KYCStatus represents the status of a KYC verification
type KYCStatus string

const (
	KYCStatusPending  KYCStatus = "pending"
	KYCStatusVerified KYCStatus = "verified"
	KYCStatusRejected KYCStatus = "rejected"
)

// IdentityType represents the type of identity document used
type IdentityType string

const (
	IdentityTypeBVN IdentityType = "bvn"
	IdentityTypeNIN IdentityType = "nin"
)

// JSONMap is a custom type for storing JSON data in the database
type JSONMap map[string]interface{}

// Value implements the driver.Valuer interface for database storage
func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface for database retrieval
func (j *JSONMap) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}

	return json.Unmarshal(bytes, j)
}

// KYCVerification represents a user's KYC verification record
type KYCVerification struct {
	BaseModel

	UserID uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	User   User `gorm:"foreignKey:UserID" json:"-"`

	// Current verification tier and status
	Tier   KYCTier   `gorm:"default:0" json:"tier"`
	Status KYCStatus `gorm:"type:varchar(20);default:'pending'" json:"status"`

	// BVN verification (Tier 1)
	BVN           string     `gorm:"size:500" json:"-"`
	BVNBlindIndex *string    `gorm:"size:64;uniqueIndex" json:"-"`
	BVNVerifiedAt *time.Time `json:"bvn_verified_at,omitempty"`

	// NIN verification
	NIN           string     `gorm:"size:500" json:"-"`
	NINBlindIndex *string    `gorm:"size:64;uniqueIndex" json:"-"`
	NINVerifiedAt *time.Time `json:"nin_verified_at,omitempty"`

	// Selfie verification (Tier 3)
	SelfieVerifiedAt      *time.Time `json:"selfie_verified_at,omitempty"`
	SelfieConfidenceValue float64    `gorm:"default:0" json:"selfie_confidence_value,omitempty"`
	LivenessProbability   float64    `gorm:"default:0" json:"liveness_probability,omitempty"`

	// Address verification (Tier 3)
	AddressStreet     string     `gorm:"size:255" json:"address_street,omitempty"`
	AddressCity       string     `gorm:"size:100" json:"address_city,omitempty"`
	AddressState      string     `gorm:"size:100" json:"address_state,omitempty"`
	AddressCountry    string     `gorm:"size:100" json:"address_country,omitempty"`
	AddressVerifiedAt *time.Time `json:"address_verified_at,omitempty"`

	// Rejection information
	RejectionReason string `gorm:"size:500" json:"rejection_reason,omitempty"`
}

// TableName specifies the table name for KYCVerification model
func (KYCVerification) TableName() string {
	return "kyc_verifications"
}

// IsBVNVerified checks if BVN has been verified
func (k *KYCVerification) IsBVNVerified() bool {
	return k.BVNVerifiedAt != nil
}

// IsNINVerified checks if NIN has been verified
func (k *KYCVerification) IsNINVerified() bool {
	return k.NINVerifiedAt != nil
}

// IsSelfieVerified checks if selfie has been verified
func (k *KYCVerification) IsSelfieVerified() bool {
	return k.SelfieVerifiedAt != nil
}

// IsAddressVerified checks if address has been verified
func (k *KYCVerification) IsAddressVerified() bool {
	return k.AddressVerifiedAt != nil
}

// IsTier1Complete checks if Tier 1 verification is complete
func (k *KYCVerification) IsTier1Complete() bool {
	return k.Tier >= KYCTier1 && k.IsBVNVerified()
}

// IsTier2Complete checks if Tier 2 verification is complete
func (k *KYCVerification) IsTier2Complete() bool {
	return k.Tier >= KYCTier2 && k.IsBVNVerified() && k.IsNINVerified()
}

// IsTier3Complete checks if Tier 3 verification is complete
func (k *KYCVerification) IsTier3Complete() bool {
	return k.Tier >= KYCTier3 && k.IsTier2Complete() && k.IsSelfieVerified() && k.IsAddressVerified()
}

// KYCStatusResponse represents the KYC status returned in API responses
type KYCStatusResponse struct {
	Tier            KYCTier   `json:"tier"`
	Status          KYCStatus `json:"status"`
	BVNVerified     bool      `json:"bvn_verified"`
	NINVerified       bool         `json:"nin_verified"`
	SelfieVerified    bool         `json:"selfie_verified"`
	AddressVerified   bool         `json:"address_verified"`
	RejectionReason   string       `json:"rejection_reason,omitempty"`
	NextTier          KYCTier      `json:"next_tier,omitempty"`
}

// ToStatusResponse converts KYCVerification to KYCStatusResponse
func (k *KYCVerification) ToStatusResponse() *KYCStatusResponse {
	resp := &KYCStatusResponse{
		Tier:            k.Tier,
		Status:          k.Status,
		BVNVerified:     k.IsBVNVerified(),
		NINVerified:       k.IsNINVerified(),
		SelfieVerified:    k.IsSelfieVerified(),
		AddressVerified:   k.IsAddressVerified(),
		RejectionReason:   k.RejectionReason,
	}

	// Determine next tier
	if k.Tier < KYCTier3 && k.Status != KYCStatusRejected {
		resp.NextTier = k.Tier + 1
	}

	return resp
}
