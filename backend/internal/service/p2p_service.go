package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	emailclient "github.com/Kynettic-org/kynettic-backend/internal/clients/email"
	"github.com/Kynettic-org/kynettic-backend/internal/database"
	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// P2PService defines P2P-related business logic.
type P2PService interface {
	// CreateAd creates a new P2P ad for the given user, enforcing balance and
	// configuration constraints according to business rules.
	CreateAd(ctx context.Context, userID uuid.UUID, input CreateAdInput) (*models.P2PAd, error)

	// UpdateAd updates mutable fields of an existing P2P ad owned by the given user.
	UpdateAd(ctx context.Context, userID, adID uuid.UUID, input UpdateAdInput) (*models.P2PAd, error)

	// DeleteAd deletes (soft-deletes) an existing P2P ad owned by the given user.
	DeleteAd(ctx context.Context, userID, adID uuid.UUID) error

	// ListAds returns paginated P2P ads, with optional filters. When mineOnly is true,
	// only ads owned by the provided user are returned. currencyID, when non-zero,
	// filters by the reference currency ID (resolved via the currencies table).
	ListAds(ctx context.Context, userID uuid.UUID, adType string, currencyID uuid.UUID, mineOnly bool, page, pageSize int) ([]models.P2PAd, int64, error)

	// ListUserAds returns paginated P2P ads for a specific user, optionally filtered
	// by type, currency, and status. Unlike ListAds, it can return non-active ads.
	// currencyID, when non-zero, filters by the reference currency ID.
	ListUserAds(ctx context.Context, userID uuid.UUID, adType string, currencyID uuid.UUID, status string, page, pageSize int) ([]models.P2PAd, int64, error)

	// ListUserOrders returns paginated P2P orders where the given user is either the
	// buyer or the seller. currencyID, when non-zero, filters by the reference
	// currency ID (resolved via the currencies table).
	ListUserOrders(ctx context.Context, userID uuid.UUID, currencyID uuid.UUID, status string, page, pageSize int) ([]models.P2POrder, int64, error)

	// ExecuteTrade executes an on-platform P2P trade between fiat and crypto wallets
	// based on an existing ad. It debits and credits the appropriate wallets for
	// both taker and maker, recording a P2POrder and wallet transactions.
	ExecuteTrade(ctx context.Context, takerID uuid.UUID, input ExecuteTradeInput) (*models.P2POrder, error)

	// GetTopTraders returns users ranked by completed P2P trade count and volume.
	// currency is optional; pass "" to include all currencies.
	GetTopTraders(currency string, page, pageSize int) ([]TopTrader, int64, error)

	// ListAllOrders returns paginated P2P orders for admin use, with optional
	// filters for status, currency, user (buyer or seller), and date range.
	ListAllOrders(ctx context.Context, filter AdminOrderFilter, page, pageSize int) ([]AdminP2POrderResponse, int64, error)
}

// AdminOrderFilter holds optional filter params for the admin orders endpoint.
type AdminOrderFilter struct {
	Status   string
	Currency string
	UserID   uuid.UUID
	From     *string // RFC3339 date string
	To       *string // RFC3339 date string
}

// AdminP2POrderResponse enriches a P2POrder with buyer and seller display info.
type AdminP2POrderResponse struct {
	models.P2POrder
	Buyer  *AdminOrderParty `json:"buyer"`
	Seller *AdminOrderParty `json:"seller"`
}

// AdminOrderParty is a minimal user projection used in admin order responses.
type AdminOrderParty struct {
	ID       uuid.UUID `json:"id"`
	UID      string    `json:"uid"`
	Email    string    `json:"email"`
	Username string    `json:"username"`
}

// TopTrader is the response shape for a single entry in the top traders list.
type TopTrader struct {
	User             *models.UserResponse       `json:"user"`
	CompletedTrades  int64                      `json:"completed_trades"`
	VolumeByCurrency map[string]decimal.Decimal `json:"volume_by_currency"`
	LastTradeAt      string                     `json:"last_trade_at"`
}

// CreateAdInput is the service-level representation of an ad creation request.
type CreateAdInput struct {
	Type            string
	CurrencyID      uuid.UUID // reference to currencies.id
	Currency        string    // resolved symbol (e.g. USDT, NGN)
	Price           decimal.Decimal
	PriceType       string
	RelativePercent decimal.Decimal
	MinAmount       decimal.Decimal
	RolloverEnabled bool
	TotalQuantity   decimal.Decimal
	IsPrivate       bool
	Pin             string
}

// UpdateAdInput contains optional fields that can be modified on an existing
// P2P ad. Fields left as nil are not changed.
type UpdateAdInput struct {
	Price           *decimal.Decimal
	PriceType       *string
	RelativePercent *decimal.Decimal
	TotalQuantity   *decimal.Decimal
	MinAmount       *decimal.Decimal
	IsPrivate       *bool
	Status          *string // e.g. "active", "paused", "closed"
	Pin             string
}

// ExecuteTradeInput represents the parameters required to execute a trade
// against an existing P2P ad. The caller supplies their raw input amount and
// which currency it is denominated in; the service derives the other side.
type ExecuteTradeInput struct {
	AdID          uuid.UUID
	AmountInput   decimal.Decimal // the user's raw input value
	InputCurrency string          // "fiat" or "crypto"
	Pin           string
}

type p2pService struct {
	adRepo          repository.P2PAdRepository
	currencyRepo    repository.CurrencyRepository
	priceService    PriceService
	referralService ReferralService
	feePercent      decimal.Decimal
	emailSender     emailclient.Sender
	anomalyService  AnomalyService
}

// NewP2PService constructs a P2PService.
func NewP2PService(adRepo repository.P2PAdRepository, currencyRepo repository.CurrencyRepository, priceService PriceService, referralService ReferralService, feePercent decimal.Decimal, emailSender emailclient.Sender, anomalyService AnomalyService) P2PService {
	return &p2pService{
		adRepo:          adRepo,
		currencyRepo:    currencyRepo,
		priceService:    priceService,
		referralService: referralService,
		feePercent:      feePercent,
		emailSender:     emailSender,
		anomalyService:  anomalyService,
	}
}

// normalizeAndValidateInput performs basic normalization and validation that
// does not require database access.
func normalizeAndValidateInput(input *CreateAdInput) error {
	input.Type = strings.ToLower(strings.TrimSpace(input.Type))
	if input.Type != "buy" && input.Type != "sell" {
		return utils.NewSafeError("type must be 'buy' or 'sell'")
	}

	input.Currency = strings.ToUpper(strings.TrimSpace(input.Currency))
	if input.Currency == "" {
		return utils.NewSafeError("currency is required")
	}

	input.PriceType = strings.ToLower(strings.TrimSpace(input.PriceType))
	if input.PriceType == "" {
		input.PriceType = "fixed"
	}
	if input.PriceType != "fixed" && input.PriceType != "relative" {
		return utils.NewSafeError("price_type must be 'fixed' or 'relative'")
	}

	// Validate price_type specific requirements
	if input.PriceType == "fixed" {
		if !input.Price.IsPositive() {
			return utils.NewSafeError("price must be greater than zero for fixed pricing")
		}
		if input.RelativePercent.IsPositive() || input.RelativePercent.IsNegative() {
			return utils.NewSafeError("relative_percent should not be set for fixed pricing")
		}
	} else if input.PriceType == "relative" {
		if input.RelativePercent.IsZero() {
			return utils.NewSafeError("relative_percent is required and must be non-zero for relative pricing")
		}
		if input.RelativePercent.LessThan(decimal.NewFromFloat(-99.99)) {
			return utils.NewSafeError("relative_percent cannot be less than -99.99")
		}
		if input.Price.IsPositive() {
			return utils.NewSafeError("price should not be set for relative pricing; use relative_percent instead")
		}
	}

	if !input.MinAmount.IsPositive() {
		return utils.NewSafeError("min_amount must be greater than zero")
	}

	// For non-rollover ads we will validate TotalQuantity later
	// for rollover ads).

	return nil
}

func (s *p2pService) CreateAd(ctx context.Context, userID uuid.UUID, input CreateAdInput) (*models.P2PAd, error) {
	if userID == uuid.Nil {
		return nil, utils.NewSafeError("invalid user")
	}

	if err := verifyUserPin(userID, input.Pin); err != nil {
		return nil, err
	}

	// Resolve currency symbol from currency_id so downstream logic can
	// continue to work with symbols (wallets, P2PAd.Currency, etc.).
	if input.CurrencyID == uuid.Nil {
		return nil, utils.NewSafeError("currency_id is required")
	}
	if s.currencyRepo == nil {
		return nil, utils.NewSafeError("currency repository not configured")
	}
	cur, err := s.currencyRepo.FindByID(input.CurrencyID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.NewSafeError("unsupported currency")
		}
		return nil, err
	}
	input.Currency = strings.ToUpper(strings.TrimSpace(cur.Symbol))

	if err := normalizeAndValidateInput(&input); err != nil {
		return nil, err
	}

	// Execute balance checks and persistence atomically.
	var ad *models.P2PAd
	if err := database.Transaction(func(tx *gorm.DB) error {
		// Attach context.
		tx = tx.WithContext(ctx)

		// For rollover ads, we do not reserve a fixed quantity up-front.
		// For non-rollover ads, enforce that TotalQuantity is positive and
		// reserve it in the user's wallet via locked_balance.
		// Determine the wallet currency for balance checks:
		// sell ads lock the crypto wallet; buy ads lock the fiat (NGN) wallet.
		lockCurrency := walletCurrencyForAd(input.Type, input.Currency)

		if input.RolloverEnabled {
			// Optional sanity check: ensure the user has at least some available
			// balance in the relevant wallet; otherwise the ad cannot be filled.
			var wallet models.Wallet
			if err := tx.Where("user_id = ? AND currency = ?", userID, lockCurrency).First(&wallet).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return utils.NewSafeError("insufficient balance")
				}
				return err
			}
			available := wallet.Balance - wallet.LockedBalance
			if available <= 0 {
				return utils.NewSafeError("insufficient balance")
			}
		} else {
			if !input.TotalQuantity.IsPositive() {
				return utils.NewSafeError("total_quantity must be greater than zero when rollover is disabled")
			}

			// Reserve funds in the appropriate wallet by increasing locked_balance.
			// For SELL ads, lock the crypto wallet.
			// For BUY ads, lock the fiat (NGN) wallet.
			lockDecimals, err := utils.CurrencyDecimalsFromDB(tx, lockCurrency)
			if err != nil {
				return fmt.Errorf("failed to get currency decimals: %w", err)
			}
			lockUnits := utils.ToStorageUnits(input.TotalQuantity, lockDecimals)
			res := tx.Model(&models.Wallet{}).
				Where("user_id = ? AND currency = ? AND balance - locked_balance >= ?", userID, lockCurrency, lockUnits).
				Update("locked_balance", gorm.Expr("locked_balance + ?", lockUnits))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return utils.NewSafeError("insufficient balance")
			}
		}

		// Build the ad model.
		newAd := &models.P2PAd{
			UserID:            userID,
			Type:              input.Type,
			Currency:          input.Currency,
			Price:             input.Price,
			PriceType:         input.PriceType,
			RelativePercent:   input.RelativePercent,
			MinAmount:         input.MinAmount,
			RolloverEnabled:   input.RolloverEnabled,
			TotalQuantity:     decimal.Zero,
			RemainingQuantity: decimal.Zero,
			IsPrivate:         input.IsPrivate,
			Status:            "active",
		}

		if !input.RolloverEnabled {
			newAd.TotalQuantity = input.TotalQuantity
			newAd.RemainingQuantity = input.TotalQuantity
		}

		if err := s.adRepo.Create(tx, newAd); err != nil {
			return err
		}

		ad = newAd
		return nil
	}); err != nil {
		return nil, err
	}

	return ad, nil
}

// UpdateAd updates mutable fields of an existing P2P ad owned by the given user.
// When a non-rollover ad is transitioned to "closed", any remaining locked
// liquidity for that ad is released back to the user's wallet.
func (s *p2pService) UpdateAd(ctx context.Context, userID, adID uuid.UUID, input UpdateAdInput) (*models.P2PAd, error) {
	if userID == uuid.Nil {
		return nil, utils.NewSafeError("invalid user")
	}
	if adID == uuid.Nil {
		return nil, utils.NewSafeError("ad_id is required")
	}

	if err := verifyUserPin(userID, input.Pin); err != nil {
		return nil, err
	}

	var updated *models.P2PAd

	if err := database.Transaction(func(tx *gorm.DB) error {
		tx = tx.WithContext(ctx)

		var ad models.P2PAd
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", adID, userID).
			First(&ad).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return utils.NewSafeError("ad not found")
			}
			return err
		}

		originalStatus := strings.ToLower(strings.TrimSpace(ad.Status))

		// Closed ads are immutable.
		if originalStatus == "closed" {
			return utils.NewSafeError("cannot update a closed ad")
		}

		// Build a temporary CreateAdInput using current values, then overlay updates
		// and reuse normalizeAndValidateInput for basic validation.
		tmp := CreateAdInput{
			Type:            ad.Type,
			CurrencyID:      uuid.Nil,
			Currency:        ad.Currency,
			Price:           ad.Price,
			PriceType:       ad.PriceType,
			RelativePercent: ad.RelativePercent,
			MinAmount:       ad.MinAmount,
			RolloverEnabled: ad.RolloverEnabled,
			TotalQuantity:   ad.TotalQuantity,
			IsPrivate:       ad.IsPrivate,
		}

		if input.Price != nil {
			tmp.Price = *input.Price
		}
		if input.PriceType != nil {
			tmp.PriceType = *input.PriceType
		}
		if input.RelativePercent != nil {
			tmp.RelativePercent = *input.RelativePercent
		}
		if input.MinAmount != nil {
			tmp.MinAmount = *input.MinAmount
		}
		if input.TotalQuantity != nil {
			if ad.RolloverEnabled {
				return utils.NewSafeError("cannot set total_quantity on a rollover ad")
			}
			tmp.TotalQuantity = *input.TotalQuantity
		}

		if err := normalizeAndValidateInput(&tmp); err != nil {
			return err
		}

		// Apply validated fields back to the ad.
		ad.Price = tmp.Price
		ad.PriceType = tmp.PriceType
		ad.RelativePercent = tmp.RelativePercent
		ad.MinAmount = tmp.MinAmount

		// Apply total_quantity change and adjust wallet locked_balance to match.
		if input.TotalQuantity != nil {
			oldQty := ad.TotalQuantity
			newQty := tmp.TotalQuantity
			consumed := oldQty.Sub(ad.RemainingQuantity)

			if newQty.LessThan(consumed) {
				return utils.NewSafeError("total_quantity cannot be less than the already-consumed quantity")
			}

			delta := newQty.Sub(oldQty) // positive = increase, negative = decrease

			if !delta.IsZero() {
				lockCurrency := walletCurrencyForAd(ad.Type, ad.Currency)
				lockDecimals, err := utils.CurrencyDecimalsFromDB(tx, lockCurrency)
				if err != nil {
					return fmt.Errorf("failed to get currency decimals: %w", err)
				}
				deltaUnits := utils.ToStorageUnits(delta.Abs(), lockDecimals)

				if delta.IsPositive() {
					// Increase: lock additional funds.
					res := tx.Model(&models.Wallet{}).
						Where("user_id = ? AND currency = ? AND balance - locked_balance >= ?",
							userID, lockCurrency, deltaUnits).
						Update("locked_balance", gorm.Expr("locked_balance + ?", deltaUnits))
					if res.Error != nil {
						return res.Error
					}
					if res.RowsAffected == 0 {
						return utils.NewSafeError("insufficient balance")
					}
				} else {
					// Decrease: release excess locked funds.
					res := tx.Model(&models.Wallet{}).
						Where("user_id = ? AND currency = ? AND locked_balance >= ?",
							userID, lockCurrency, deltaUnits).
						Update("locked_balance", gorm.Expr("locked_balance - ?", deltaUnits))
					if res.Error != nil {
						return res.Error
					}
					if res.RowsAffected == 0 {
						return utils.NewSafeError("insufficient locked balance for ad")
					}
				}

				ad.TotalQuantity = newQty
				ad.RemainingQuantity = ad.RemainingQuantity.Add(delta)
			}
		}

		if input.IsPrivate != nil {
			ad.IsPrivate = *input.IsPrivate
		}

		closing := false
		if input.Status != nil {
			status := strings.ToLower(strings.TrimSpace(*input.Status))
			if status != "" && status != "active" && status != "paused" && status != "closed" {
				return utils.NewSafeError("invalid status; must be active, paused, or closed")
			}
			if status != "" {
				ad.Status = status
				if originalStatus != "closed" && status == "closed" {
					closing = true
				}
			}
		}

		// If we are closing a non-rollover ad with remaining liquidity, release the
		// remaining locked balance back to the user's wallet.
		if closing && !ad.RolloverEnabled && ad.RemainingQuantity.GreaterThan(decimal.Zero) {
			unlockCurrency := walletCurrencyForAd(ad.Type, ad.Currency)
			unlockDecimals, err := utils.CurrencyDecimalsFromDB(tx, unlockCurrency)
			if err != nil {
				return fmt.Errorf("failed to get currency decimals: %w", err)
			}
			unlockUnits := utils.ToStorageUnits(ad.RemainingQuantity, unlockDecimals)
			res := tx.Model(&models.Wallet{}).
				Where("user_id = ? AND currency = ? AND locked_balance >= ?", userID, unlockCurrency, unlockUnits).
				Update("locked_balance", gorm.Expr("locked_balance - ?", unlockUnits))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return utils.NewSafeError("insufficient locked balance for ad")
			}

			ad.RemainingQuantity = decimal.Zero
		}

		if err := tx.Save(&ad).Error; err != nil {
			return err
		}

		updated = &ad
		return nil
	}); err != nil {
		return nil, err
	}

	return updated, nil
}

// DeleteAd deletes (soft-deletes) an existing P2P ad owned by the given user.
// For non-rollover ads, any remaining locked liquidity is released back to the
// user's wallet. Ads with open orders cannot be deleted.
func (s *p2pService) DeleteAd(ctx context.Context, userID, adID uuid.UUID) error {
	if userID == uuid.Nil {
		return utils.NewSafeError("invalid user")
	}
	if adID == uuid.Nil {
		return utils.NewSafeError("ad_id is required")
	}

	return database.Transaction(func(tx *gorm.DB) error {
		tx = tx.WithContext(ctx)

		var ad models.P2PAd
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", adID, userID).
			First(&ad).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return utils.NewSafeError("ad not found")
			}
			return err
		}

		// Prevent deletion if there are open orders referencing this ad.
		var openCount int64
		if err := tx.Model(&models.P2POrder{}).
			Where("ad_id = ? AND status IN ?", adID, []string{"pending", "paid", "disputed"}).
			Count(&openCount).Error; err != nil {
			return err
		}
		if openCount > 0 {
			return utils.NewSafeError("cannot delete ad with open orders")
		}

		// Release remaining locked liquidity for non-rollover ads.
		if !ad.RolloverEnabled && ad.RemainingQuantity.GreaterThan(decimal.Zero) {
			unlockCurrency := walletCurrencyForAd(ad.Type, ad.Currency)
			delDecimals, err := utils.CurrencyDecimalsFromDB(tx, unlockCurrency)
			if err != nil {
				return fmt.Errorf("failed to get currency decimals: %w", err)
			}
			delUnlockUnits := utils.ToStorageUnits(ad.RemainingQuantity, delDecimals)
			res := tx.Model(&models.Wallet{}).
				Where("user_id = ? AND currency = ? AND locked_balance >= ?", userID, unlockCurrency, delUnlockUnits).
				Update("locked_balance", gorm.Expr("locked_balance - ?", delUnlockUnits))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return utils.NewSafeError("insufficient locked balance for ad")
			}
		}

		if err := tx.Delete(&ad).Error; err != nil {
			return err
		}

		return nil
	})
}

const p2pFiatCurrencySymbol = "NGN"

// walletCurrencyForAd returns the wallet currency to use for locking/unlocking
// ad capacity. Sell ads lock the crypto wallet; buy ads lock the fiat wallet.
func walletCurrencyForAd(adType, cryptoCurrency string) string {
	if strings.ToLower(strings.TrimSpace(adType)) == "buy" {
		return p2pFiatCurrencySymbol
	}
	return cryptoCurrency
}

// enrichRolloverAds sets RemainingQuantity to the maker's live available
// balance (balance - locked_balance) for rollover ads in the slice.
// A single batch wallet query is used so this is efficient for paginated lists.
func enrichRolloverAds(ctx context.Context, ads []models.P2PAd) error {
	type walletKey struct {
		UserID   uuid.UUID
		Currency string
	}

	// Collect unique user IDs from rollover ads only.
	userIDSet := make(map[uuid.UUID]struct{})
	for _, ad := range ads {
		if ad.RolloverEnabled {
			userIDSet[ad.UserID] = struct{}{}
		}
	}
	if len(userIDSet) == 0 {
		return nil
	}

	userIDs := make([]uuid.UUID, 0, len(userIDSet))
	for id := range userIDSet {
		userIDs = append(userIDs, id)
	}

	db := database.GetDB().WithContext(ctx)

	var wallets []models.Wallet
	if err := db.Where("user_id IN ?", userIDs).Find(&wallets).Error; err != nil {
		return err
	}

	index := make(map[walletKey]*models.Wallet, len(wallets))
	for i := range wallets {
		index[walletKey{wallets[i].UserID, wallets[i].Currency}] = &wallets[i]
	}

	for i, ad := range ads {
		if !ad.RolloverEnabled {
			continue
		}
		cur := walletCurrencyForAd(ad.Type, ad.Currency)
		w, ok := index[walletKey{ad.UserID, cur}]
		if !ok {
			continue
		}
		dec, err := utils.CurrencyDecimalsFromDB(db, cur)
		if err != nil {
			continue
		}
		availUnits := w.Balance - w.LockedBalance
		if availUnits < 0 {
			availUnits = 0
		}
		ads[i].RemainingQuantity = utils.FromStorageUnits(availUnits, dec)
	}
	return nil
}

// ListAds returns paginated P2P ads with optional filters for type, currency
// (by reference currency ID), and ownership (mineOnly). By default it only
// returns active ads.
func (s *p2pService) ListAds(ctx context.Context, userID uuid.UUID, adType string, currencyID uuid.UUID, mineOnly bool, page, pageSize int) ([]models.P2PAd, int64, error) {
	var ads []models.P2PAd
	var total int64

	db := database.GetDB().WithContext(ctx).Model(&models.P2PAd{}).
		Where("status = ?", "active")

	adType = strings.ToLower(strings.TrimSpace(adType))
	if adType != "" {
		db = db.Where("type = ?", adType)
	}

	// If a currency ID is provided, resolve it to a symbol via the reference
	// currencies table and filter ads by that symbol.
	if currencyID != uuid.Nil {
		if s.currencyRepo == nil {
			return nil, 0, utils.NewSafeError("currency repository not configured")
		}
		cur, err := s.currencyRepo.FindByID(currencyID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, 0, utils.NewSafeError("unsupported currency")
			}
			return nil, 0, err
		}
		symbol := strings.ToUpper(strings.TrimSpace(cur.Symbol))
		if symbol == "" {
			return nil, 0, utils.NewSafeError("currency symbol is not configured")
		}
		db = db.Where("currency = ?", symbol)
	}

	if mineOnly {
		if userID == uuid.Nil {
			return nil, 0, utils.NewSafeError("invalid user for mine_only filter")
		}
		db = db.Where("user_id = ?", userID)
	}

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Preload("User").Find(&ads).Error; err != nil {
		return nil, 0, err
	}

	for i := range ads {
		if ads[i].User != nil && ads[i].User.DisplayUsernameOnP2P {
			ads[i].Username = ads[i].User.Username
		}
	}

	if err := enrichRolloverAds(ctx, ads); err != nil {
		return nil, 0, err
	}

	return ads, total, nil
}

// ListUserAds returns paginated P2P ads for a single user, optionally filtered
// by ad type, currency (by reference currency ID), and status. It returns ads
// in any status.
func (s *p2pService) ListUserAds(ctx context.Context, userID uuid.UUID, adType string, currencyID uuid.UUID, status string, page, pageSize int) ([]models.P2PAd, int64, error) {
	if userID == uuid.Nil {
		return nil, 0, utils.NewSafeError("invalid user")
	}

	var ads []models.P2PAd
	var total int64

	db := database.GetDB().WithContext(ctx).Model(&models.P2PAd{}).
		Where("user_id = ?", userID)

	adType = strings.ToLower(strings.TrimSpace(adType))
	if adType != "" {
		db = db.Where("type = ?", adType)
	}

	// If a currency ID is provided, resolve it to a symbol via the reference
	// currencies table and filter ads by that symbol.
	if currencyID != uuid.Nil {
		if s.currencyRepo == nil {
			return nil, 0, utils.NewSafeError("currency repository not configured")
		}
		cur, err := s.currencyRepo.FindByID(currencyID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, 0, utils.NewSafeError("unsupported currency")
			}
			return nil, 0, err
		}
		symbol := strings.ToUpper(strings.TrimSpace(cur.Symbol))
		if symbol == "" {
			return nil, 0, utils.NewSafeError("currency symbol is not configured")
		}
		db = db.Where("currency = ?", symbol)
	}

	status = strings.ToLower(strings.TrimSpace(status))
	if status != "" {
		db = db.Where("status = ?", status)
	}

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&ads).Error; err != nil {
		return nil, 0, err
	}

	if err := enrichRolloverAds(ctx, ads); err != nil {
		return nil, 0, err
	}

	return ads, total, nil
}

// ListUserOrders
// seller, optionally filtered by crypto currency (by reference currency ID)
// and status.
func (s *p2pService) ListUserOrders(ctx context.Context, userID uuid.UUID, currencyID uuid.UUID, status string, page, pageSize int) ([]models.P2POrder, int64, error) {
	if userID == uuid.Nil {
		return nil, 0, utils.NewSafeError("invalid user")
	}

	var orders []models.P2POrder
	var total int64

	db := database.GetDB().WithContext(ctx).Model(&models.P2POrder{}).
		Where("buyer_id = ? OR seller_id = ?", userID, userID)

	// If a currency ID is provided, resolve it to a symbol via the reference
	// currencies table and filter orders by that symbol.
	if currencyID != uuid.Nil {
		if s.currencyRepo == nil {
			return nil, 0, utils.NewSafeError("currency repository not configured")
		}
		cur, err := s.currencyRepo.FindByID(currencyID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, 0, utils.NewSafeError("unsupported currency")
			}
			return nil, 0, err
		}
		symbol := strings.ToUpper(strings.TrimSpace(cur.Symbol))
		if symbol == "" {
			return nil, 0, utils.NewSafeError("currency symbol is not configured")
		}
		db = db.Where("currency = ?", symbol)
	}

	status = strings.ToLower(strings.TrimSpace(status))
	if status != "" {
		db = db.Where("status = ?", status)
	}

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&orders).Error; err != nil {
		return nil, 0, err
	}

	return orders, total, nil
}

func (s *p2pService) ListAllOrders(ctx context.Context, filter AdminOrderFilter, page, pageSize int) ([]AdminP2POrderResponse, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}

	db := database.GetDB().WithContext(ctx).Model(&models.P2POrder{})

	if filter.Status != "" {
		db = db.Where("status = ?", strings.ToLower(filter.Status))
	}
	if filter.Currency != "" {
		db = db.Where("currency = ?", strings.ToUpper(filter.Currency))
	}
	if filter.UserID != uuid.Nil {
		db = db.Where("buyer_id = ? OR seller_id = ?", filter.UserID, filter.UserID)
	}
	if filter.From != nil {
		db = db.Where("created_at >= ?", *filter.From)
	}
	if filter.To != nil {
		db = db.Where("created_at <= ?", *filter.To)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var orders []models.P2POrder
	offset := (page - 1) * pageSize
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&orders).Error; err != nil {
		return nil, 0, err
	}

	if len(orders) == 0 {
		return []AdminP2POrderResponse{}, total, nil
	}

	// Collect unique user IDs to batch-load buyer/seller info.
	idSet := make(map[uuid.UUID]struct{})
	for _, o := range orders {
		idSet[o.BuyerID] = struct{}{}
		idSet[o.SellerID] = struct{}{}
	}
	ids := make([]uuid.UUID, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}

	type userRow struct {
		ID       uuid.UUID
		UID      string
		Email    string
		Username string
	}
	var userRows []userRow
	if err := database.GetDB().WithContext(ctx).
		Table("users").
		Select("users.id, users.uid, users.email, COALESCE(up.username, '') AS username").
		Joins("LEFT JOIN user_profiles up ON up.user_id = users.id").
		Where("users.id IN ? AND users.deleted_at IS NULL", ids).
		Scan(&userRows).Error; err != nil {
		return nil, 0, err
	}

	userMap := make(map[uuid.UUID]*AdminOrderParty, len(userRows))
	for i := range userRows {
		r := &userRows[i]
		userMap[r.ID] = &AdminOrderParty{
			ID:       r.ID,
			UID:      r.UID,
			Email:    r.Email,
			Username: r.Username,
		}
	}

	responses := make([]AdminP2POrderResponse, len(orders))
	for i, o := range orders {
		responses[i] = AdminP2POrderResponse{
			P2POrder: o,
			Buyer:    userMap[o.BuyerID],
			Seller:   userMap[o.SellerID],
		}
	}
	return responses, total, nil
}

// ExecuteTrade executes an automated on-platform trade between fiat and crypto
// wallets based on an existing P2P ad. It supports both "buy" and "sell" ads
// and prevents double-spending by using atomic balance updates with
// balance-locked_balance checks.
//
// Security invariants (from security review):
//  1. A user must never be able to trade with themselves (taker != maker).
//  2. Rollover ads must always re-check the user's real-time balance at
//     execution time to avoid race conditions.
//  3. Escrow-style isolation must be maintained by using dedicated
//     wallet balances/locks for P2P operations.
func (s *p2pService) ExecuteTrade(ctx context.Context, takerID uuid.UUID, input ExecuteTradeInput) (*models.P2POrder, error) {
	if takerID == uuid.Nil {
		return nil, utils.NewSafeError("invalid user")
	}
	if input.AdID == uuid.Nil {
		return nil, utils.NewSafeError("ad_id is required")
	}
	if !input.AmountInput.IsPositive() {
		return nil, utils.NewSafeError("amount must be greater than zero")
	}
	if input.InputCurrency != "fiat" && input.InputCurrency != "crypto" {
		return nil, utils.NewSafeError("input_currency must be 'fiat' or 'crypto'")
	}

	if err := verifyUserPin(takerID, input.Pin); err != nil {
		return nil, err
	}

	// ── Anomaly / fraud scoring ────────────────────────────────────────────
	// Score the trade before touching wallets. CRITICAL scores (≥76) abort
	// execution; lower scores are logged and may trigger alerts.
	if s.anomalyService != nil {
		anomalyInput := AnomalyInput{
			TakerID:     takerID,
			AdID:        input.AdID,
			AmountUSD:   input.AmountInput, // best approximation pre-price-calc
		}
		score, err := s.anomalyService.ScoreTrade(ctx, anomalyInput)
		if err != nil {
			logger.FromCtx(ctx).Warn("anomaly: scoring error (non-blocking)", zap.Error(err))
		} else if IsCritical(score) {
			return nil, utils.NewSafeError("trade blocked: high fraud risk detected")
		}
	}

	var order *models.P2POrder

	// Fields captured from inside the transaction for post-commit email sending.
	var (
		emailCrypto    string
		emailAmount    decimal.Decimal
		emailPrice     decimal.Decimal
		emailFiatTotal decimal.Decimal
	)

	if err := database.Transaction(func(tx *gorm.DB) error {
		tx = tx.WithContext(ctx)

		// Lock the ad row to prevent concurrent over-selling.
		var ad models.P2PAd
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", input.AdID).First(&ad).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return utils.NewSafeError("ad not found")
			}
			return err
		}

		if ad.Status != "active" {
			return utils.NewSafeError("ad is not active")
		}

		if takerID == ad.UserID {
			return utils.NewSafeError("cannot trade against your own ad")
		}

		// Resolve currency symbols and calculate effective price early,
		// because buy-ad limit/capacity checks require the fiat total.
		cryptoSymbol := strings.ToUpper(strings.TrimSpace(ad.Currency))
		if cryptoSymbol == "" {
			return utils.NewSafeError("ad currency is not configured")
		}
		fiatSymbol := p2pFiatCurrencySymbol

		// Fetch the currency record to get CoinGecko ID for relative pricing
		var currency models.Currency
		if err := tx.Where("symbol = ?", cryptoSymbol).First(&currency).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return utils.NewSafeError("currency not found")
			}
			return err
		}

		// Calculate effective price (handles both fixed and relative pricing)
		price, err := s.priceService.CalculateEffectivePrice(ctx, &ad, &currency)
		if err != nil {
			return fmt.Errorf("failed to calculate price: %w", err)
		}
		if !price.IsPositive() {
			return utils.NewSafeError("effective ad price must be greater than zero")
		}

		// Derive both sides of the trade server-side. The client supplies only a
		// raw input amount and which currency it is in; we never trust a
		// client-provided price, crypto quantity, or fiat total.
		cryptoPrecision := int32(currency.Decimals)
		const fiatPrecision = int32(2)

		var amount, fiatTotal decimal.Decimal
		switch input.InputCurrency {
		case "crypto":
			amount = input.AmountInput.Truncate(cryptoPrecision)
			fiatTotal = amount.Mul(price)
		case "fiat":
			amount = input.AmountInput.Div(price).Truncate(cryptoPrecision)
			fiatTotal = amount.Mul(price)
		}
		// Truncate fiat to 2 decimal places and recalculate crypto if fiat was the input,
		// ensuring both sides are stored at their currency's precision.
		fiatTotal = fiatTotal.Truncate(fiatPrecision)

		if !amount.IsPositive() {
			return utils.NewSafeError("derived crypto amount is too small")
		}

		adType := strings.ToLower(strings.TrimSpace(ad.Type))

		// Calculate platform fees for both sides of the trade, truncated to each
		// currency's precision so stored fee amounts match what ToStorageUnits applies.
		feeRate := s.feePercent.Div(decimal.NewFromInt(100))
		cryptoFee := amount.Mul(feeRate).Truncate(cryptoPrecision)
		fiatFee := fiatTotal.Mul(feeRate).Truncate(fiatPrecision)

		// Enforce minimum fees to prevent micro-trade fee evasion: if the
		// calculated fee truncates to zero, charge the smallest representable unit.
		minCryptoFee := decimal.New(1, -cryptoPrecision)
		minFiatFee := decimal.NewFromFloat(0.01)
		if amount.IsPositive() && cryptoFee.IsZero() {
			cryptoFee = minCryptoFee
		}
		if fiatTotal.IsPositive() && fiatFee.IsZero() {
			fiatFee = minFiatFee
		}

		// Assign maker/taker fees based on which side each party is on.
		// SELL ad: maker is on crypto side, taker is on fiat side.
		// BUY  ad: maker is on fiat side,  taker is on crypto side.
		var makerFee, takerFee decimal.Decimal
		var makerFeeCurrency, takerFeeCurrency string
		if adType == "sell" {
			makerFee, makerFeeCurrency = cryptoFee, cryptoSymbol
			takerFee, takerFeeCurrency = fiatFee, fiatSymbol
		} else {
			makerFee, makerFeeCurrency = fiatFee, fiatSymbol
			takerFee, takerFeeCurrency = cryptoFee, cryptoSymbol
		}
		// Keep a local alias used in the capacity / wallet logic below.
		fee := cryptoFee

		// Validate amount against per-order limits.
		// Enforce per-order minimum. The maximum is the remaining_quantity
		// (checked below for non-rollover; live balance check for rollover).
		if adType == "buy" {
			if fiatTotal.LessThan(ad.MinAmount) {
				return utils.NewSafeError("trade total is below min_amount for this ad")
			}
		} else {
			if amount.LessThan(ad.MinAmount) {
				return utils.NewSafeError("amount is below min_amount for this ad")
			}
		}

		// For non-rollover ads, enforce remaining capacity.
		// Buy ads: capacity is in fiat; sell ads: capacity is in crypto.
		if !ad.RolloverEnabled {
			deduction := amount
			if adType == "buy" {
				deduction = fiatTotal.Add(fiatFee) // maker pays fiatTotal + fiatFee
			} else if adType == "sell" {
				deduction = amount.Add(fee) // maker pays amount + cryptoFee
			}
			if ad.RemainingQuantity.LessThan(deduction) {
				return utils.NewSafeError("insufficient ad liquidity")
			}
			ad.RemainingQuantity = ad.RemainingQuantity.Sub(deduction)
			if ad.RemainingQuantity.IsZero() {
				ad.Status = "closed"
			}
			if err := tx.Save(&ad).Error; err != nil {
				return err
			}
		}

		makerID := ad.UserID
		var buyerID, sellerID uuid.UUID

		switch adType {
		case "sell":
			// Maker sells crypto, taker buys crypto (pays fiat).
			sellerID = makerID
			buyerID = takerID
		case "buy":
			// Maker buys crypto with fiat, taker sells crypto.
			buyerID = makerID
			sellerID = takerID
		default:
			return utils.NewSafeError("unsupported ad type")
		}

		// Generate a 20-digit public order number.
		orderNumber, err := utils.Generate20DigitUID()
		if err != nil {
			return err
		}

		// Create order record first so we have an ID for wallet transaction references.
		newOrder := &models.P2POrder{
			OrderNumber:      orderNumber,
			AdID:             ad.ID,
			BuyerID:          buyerID,
			SellerID:         sellerID,
			Type:             adType,
			Currency:         cryptoSymbol,
			Amount:           amount,
			Price:            price,
			Total:            fiatTotal,
			MakerFeeAmount:   makerFee,
			MakerFeeCurrency: makerFeeCurrency,
			TakerFeeAmount:   takerFee,
			TakerFeeCurrency: takerFeeCurrency,
			Status:           "completed",
		}

		if err := tx.Create(newOrder).Error; err != nil {
			return err
		}

		refID := fmt.Sprintf("p2p_order:%s", newOrder.ID.String())

		// Helper closures for wallet debit/credit + transaction recording.
		// Returns (wallet, balanceBefore, balanceAfter, error) — all balance values
		// are human-readable decimals suitable for WalletTransaction records.
		debitWallet := func(userID uuid.UUID, currency string, amt decimal.Decimal) (*models.Wallet, decimal.Decimal, decimal.Decimal, error) {
			dec, err := utils.CurrencyDecimalsFromDB(tx, currency)
			if err != nil {
				return nil, decimal.Zero, decimal.Zero, fmt.Errorf("get decimals for %s: %w", currency, err)
			}
			amtUnits := utils.ToStorageUnits(amt, dec)
			// Atomically decrement balance if sufficient available funds.
			res := tx.Model(&models.Wallet{}).
				Where("user_id = ? AND currency = ? AND balance - locked_balance >= ?", userID, currency, amtUnits).
				Update("balance", gorm.Expr("balance - ?", amtUnits))
			if res.Error != nil {
				return nil, decimal.Zero, decimal.Zero, res.Error
			}
			if res.RowsAffected == 0 {
				return nil, decimal.Zero, decimal.Zero, utils.NewSafeError("insufficient balance")
			}

			var w models.Wallet
			if err := tx.Where("user_id = ? AND currency = ?", userID, currency).First(&w).Error; err != nil {
				return nil, decimal.Zero, decimal.Zero, err
			}
			after := utils.FromStorageUnits(w.Balance, dec)
			before := after.Add(amt)
			return &w, before, after, nil
		}

		creditWallet := func(userID uuid.UUID, currency string, amt decimal.Decimal) (*models.Wallet, decimal.Decimal, decimal.Decimal, error) {
			var w models.Wallet
			if err := tx.Where("user_id = ? AND currency = ?", userID, currency).First(&w).Error; err != nil {
				if !errors.Is(err, gorm.ErrRecordNotFound) {
					return nil, decimal.Zero, decimal.Zero, err
				}

				// Create wallet if it does not exist yet. Resolve the reference
				// currency so we can populate CurrencyID.
				var cur models.Currency
				if err := tx.Where("symbol = ?", currency).First(&cur).Error; err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						return nil, decimal.Zero, decimal.Zero, utils.NewSafeError("unsupported currency for wallet")
					}
					return nil, decimal.Zero, decimal.Zero, err
				}

				w = models.Wallet{
					UserID:     userID,
					CurrencyID: cur.ID,
					Currency:   currency,
				}
				if createErr := tx.Create(&w).Error; createErr != nil {
					if !utils.IsUniqueViolation(createErr) {
						return nil, decimal.Zero, decimal.Zero, createErr
					}
					// Concurrent race: another goroutine created the wallet. Fetch it.
					if err := tx.Where("user_id = ? AND currency = ?", userID, currency).First(&w).Error; err != nil {
						return nil, decimal.Zero, decimal.Zero, err
					}
				}
			}

			dec, err := utils.CurrencyDecimalsFromDB(tx, currency)
			if err != nil {
				return nil, decimal.Zero, decimal.Zero, fmt.Errorf("get decimals for %s: %w", currency, err)
			}
			amtUnits := utils.ToStorageUnits(amt, dec)
			// Atomically credit the wallet (handles both new and existing paths).
			if err := tx.Model(&models.Wallet{}).Where("id = ?", w.ID).
				Update("balance", gorm.Expr("balance + ?", amtUnits)).Error; err != nil {
				return nil, decimal.Zero, decimal.Zero, err
			}
			if err := tx.Where("id = ?", w.ID).First(&w).Error; err != nil {
				return nil, decimal.Zero, decimal.Zero, err
			}
			after := utils.FromStorageUnits(w.Balance, dec)
			before := after.Sub(amt)
			return &w, before, after, nil
		}

		createTx := func(walletID uuid.UUID, typ string, amt decimal.Decimal, before, after decimal.Decimal, desc string) error {
			wt := &models.WalletTransaction{
				WalletID:      walletID,
				Type:          typ,
				Amount:        amt,
				BalanceBefore: before,
				BalanceAfter:  after,
				ReferenceID:   refID,
				Description:   desc,
			}
			return tx.Create(wt).Error
		}

		// Pre-fetch decimals for both currencies used in the trade legs.
		cryptoDecimals, err := utils.CurrencyDecimalsFromDB(tx, cryptoSymbol)
		if err != nil {
			return fmt.Errorf("get decimals for %s: %w", cryptoSymbol, err)
		}
		fiatDecimals, err := utils.CurrencyDecimalsFromDB(tx, fiatSymbol)
		if err != nil {
			return fmt.Errorf("get decimals for %s: %w", fiatSymbol, err)
		}

		// Execute the four legs of the trade depending on ad type.
		if adType == "sell" {
			// Maker: crypto -, fiat +
			// Taker: fiat -, crypto +

			// Maker crypto debit (may come from rollover or non-rollover funds).
			// If the ad reserved funds (non-rollover), also reduce locked_balance.
			makerCryptoDeduction := amount.Add(fee)
			if !ad.RolloverEnabled {
				makerCryptoDeductionUnits := utils.ToStorageUnits(makerCryptoDeduction, cryptoDecimals)
				// Ensure we only spend locked liquidity for this ad.
				res := tx.Model(&models.Wallet{}).
					Where("user_id = ? AND currency = ? AND locked_balance >= ?", makerID, cryptoSymbol, makerCryptoDeductionUnits).
					Updates(map[string]interface{}{
						"balance":        gorm.Expr("balance - ?", makerCryptoDeductionUnits),
						"locked_balance": gorm.Expr("locked_balance - ?", makerCryptoDeductionUnits),
					})
				if res.Error != nil {
					return res.Error
				}
				if res.RowsAffected == 0 {
					return utils.NewSafeError("insufficient locked balance for ad")
				}

				var makerCrypto models.Wallet
				if err := tx.Where("user_id = ? AND currency = ?", makerID, cryptoSymbol).First(&makerCrypto).Error; err != nil {
					return err
				}
				makerCryptoAfter := utils.FromStorageUnits(makerCrypto.Balance, cryptoDecimals)
				makerCryptoBefore := makerCryptoAfter.Add(makerCryptoDeduction)

				if err := createTx(makerCrypto.ID, "trade", makerCryptoDeduction, makerCryptoBefore, makerCryptoAfter, fmt.Sprintf("P2P sell crypto %s (incl. fee)", cryptoSymbol)); err != nil {
					return err
				}
			} else {
				makerCrypto, before, after, err := debitWallet(makerID, cryptoSymbol, makerCryptoDeduction)
				if err != nil {
					return err
				}
				if err := createTx(makerCrypto.ID, "trade", makerCryptoDeduction, before, after, fmt.Sprintf("P2P sell crypto %s (incl. fee)", cryptoSymbol)); err != nil {
					return err
				}
			}

			// Maker fiat credit.
			makerFiat, makerFiatBefore, makerFiatAfter, err := creditWallet(makerID, fiatSymbol, fiatTotal)
			if err != nil {
				return err
			}
			if err := createTx(makerFiat.ID, "trade", fiatTotal, makerFiatBefore, makerFiatAfter, fmt.Sprintf("P2P receive fiat %s", fiatSymbol)); err != nil {
				return err
			}

			// Taker fiat debit (trade amount + taker fiat fee).
			takerFiatDebit := fiatTotal.Add(takerFee)
			takerFiat, takerFiatBefore, takerFiatAfter, err := debitWallet(takerID, fiatSymbol, takerFiatDebit)
			if err != nil {
				return err
			}
			if err := createTx(takerFiat.ID, "trade", takerFiatDebit, takerFiatBefore, takerFiatAfter, fmt.Sprintf("P2P buy crypto %s (incl. fee)", cryptoSymbol)); err != nil {
				return err
			}

			// Taker crypto credit.
			takerCrypto, takerCryptoBefore, takerCryptoAfter, err := creditWallet(takerID, cryptoSymbol, amount)
			if err != nil {
				return err
			}
			if err := createTx(takerCrypto.ID, "trade", amount, takerCryptoBefore, takerCryptoAfter, fmt.Sprintf("P2P receive crypto %s", cryptoSymbol)); err != nil {
				return err
			}
		} else {
			// adType == "buy"
			// Maker: fiat -, crypto +
			// Taker: crypto -, fiat +

			// Maker fiat debit (trade amount + maker fiat fee) — for non-rollover ads use locked funds.
			makerFiatDebit := fiatTotal.Add(makerFee)
			if !ad.RolloverEnabled {
				makerFiatDebitUnits := utils.ToStorageUnits(makerFiatDebit, fiatDecimals)
				// Spend locked fiat liquidity for this ad.
				res := tx.Model(&models.Wallet{}).
					Where("user_id = ? AND currency = ? AND locked_balance >= ?", makerID, fiatSymbol, makerFiatDebitUnits).
					Updates(map[string]interface{}{
						"balance":        gorm.Expr("balance - ?", makerFiatDebitUnits),
						"locked_balance": gorm.Expr("locked_balance - ?", makerFiatDebitUnits),
					})
				if res.Error != nil {
					return res.Error
				}
				if res.RowsAffected == 0 {
					return utils.NewSafeError("insufficient locked balance for ad")
				}

				var makerFiat models.Wallet
				if err := tx.Where("user_id = ? AND currency = ?", makerID, fiatSymbol).First(&makerFiat).Error; err != nil {
					return err
				}
				makerFiatAfter := utils.FromStorageUnits(makerFiat.Balance, fiatDecimals)
				makerFiatBefore := makerFiatAfter.Add(makerFiatDebit)

				if err := createTx(makerFiat.ID, "trade", makerFiatDebit, makerFiatBefore, makerFiatAfter, fmt.Sprintf("P2P buy crypto %s (incl. fee)", cryptoSymbol)); err != nil {
					return err
				}
			} else {
				makerFiat, beforeMakerFiat, afterMakerFiat, err := debitWallet(makerID, fiatSymbol, makerFiatDebit)
				if err != nil {
					return err
				}
				if err := createTx(makerFiat.ID, "trade", makerFiatDebit, beforeMakerFiat, afterMakerFiat, fmt.Sprintf("P2P buy crypto %s (incl. fee)", cryptoSymbol)); err != nil {
					return err
				}
			}

			// Maker crypto credit (full amount — maker fee is charged in fiat).
			makerCrypto, makerCryptoBefore, makerCryptoAfter, err := creditWallet(makerID, cryptoSymbol, amount)
			if err != nil {
				return err
			}
			if err := createTx(makerCrypto.ID, "trade", amount, makerCryptoBefore, makerCryptoAfter, fmt.Sprintf("P2P receive crypto %s", cryptoSymbol)); err != nil {
				return err
			}

			// Taker crypto debit (trade amount + taker crypto fee).
			takerCryptoDebit := amount.Add(takerFee)
			takerCrypto, takerCryptoBefore, takerCryptoAfter, err := debitWallet(takerID, cryptoSymbol, takerCryptoDebit)
			if err != nil {
				return err
			}
			if err := createTx(takerCrypto.ID, "trade", takerCryptoDebit, takerCryptoBefore, takerCryptoAfter, fmt.Sprintf("P2P sell crypto %s (incl. fee)", cryptoSymbol)); err != nil {
				return err
			}

			// Taker fiat credit.
			takerFiat, takerFiatBefore, takerFiatAfter, err := creditWallet(takerID, fiatSymbol, fiatTotal)
			if err != nil {
				return err
			}
			if err := createTx(takerFiat.ID, "trade", fiatTotal, takerFiatBefore, takerFiatAfter, fmt.Sprintf("P2P receive fiat %s", fiatSymbol)); err != nil {
				return err
			}
		}

		// --- Platform fee recording (charged to both maker and taker) ---
		upsertPlatformFee := func(currency string, feeAmt decimal.Decimal) error {
			res := tx.Model(&models.PlatformFeeBalance{}).
				Where("currency = ?", currency).
				Updates(map[string]interface{}{
					"total_amount": gorm.Expr("total_amount + ?", feeAmt),
					"total_count":  gorm.Expr("total_count + 1"),
				})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return tx.Create(&models.PlatformFeeBalance{
					Currency:    currency,
					TotalAmount: feeAmt,
					TotalCount:  1,
				}).Error
			}
			return nil
		}

		// makerTradeAmount / takerTradeAmount are the bases the fees were calculated on.
		var makerTradeAmount, takerTradeAmount decimal.Decimal
		if adType == "sell" {
			makerTradeAmount = amount    // maker is on crypto side
			takerTradeAmount = fiatTotal // taker is on fiat side
		} else {
			makerTradeAmount = fiatTotal // maker is on fiat side
			takerTradeAmount = amount    // taker is on crypto side
		}

		if makerFee.IsPositive() {
			if err := tx.Create(&models.P2PTradeFee{
				OrderID:     newOrder.ID,
				Role:        "maker",
				UserID:      makerID,
				Currency:    makerFeeCurrency,
				FeeAmount:   makerFee,
				FeePercent:  s.feePercent,
				TradeAmount: makerTradeAmount,
			}).Error; err != nil {
				return err
			}
			if err := upsertPlatformFee(makerFeeCurrency, makerFee); err != nil {
				return err
			}
		}

		if takerFee.IsPositive() {
			if err := tx.Create(&models.P2PTradeFee{
				OrderID:     newOrder.ID,
				Role:        "taker",
				UserID:      takerID,
				Currency:    takerFeeCurrency,
				FeeAmount:   takerFee,
				FeePercent:  s.feePercent,
				TradeAmount: takerTradeAmount,
			}).Error; err != nil {
				return err
			}
			if err := upsertPlatformFee(takerFeeCurrency, takerFee); err != nil {
				return err
			}
		}

		// For rollover ads, update RemainingQuantity to the maker's current
		// available balance after all debits (trade + fee), so the ad always
		// reflects live remaining capacity.
		if ad.RolloverEnabled {
			capacityCurrency := walletCurrencyForAd(adType, cryptoSymbol)
			var makerWallet models.Wallet
			if err := tx.Where("user_id = ? AND currency = ?", makerID, capacityCurrency).First(&makerWallet).Error; err != nil {
				return err
			}
			capDecimals, err := utils.CurrencyDecimalsFromDB(tx, capacityCurrency)
			if err != nil {
				return fmt.Errorf("get decimals for %s: %w", capacityCurrency, err)
			}
			availUnits := makerWallet.Balance - makerWallet.LockedBalance
			if availUnits < 0 {
				availUnits = 0
			}
			available := utils.FromStorageUnits(availUnits, capDecimals)
			ad.RemainingQuantity = available
			if err := tx.Save(&ad).Error; err != nil {
				return err
			}
		}

		emailCrypto = cryptoSymbol
		emailAmount = amount
		emailPrice = price
		emailFiatTotal = fiatTotal
		order = newOrder
		return nil
	}); err != nil {
		return nil, err
	}

	// Award referral points for both buyer and seller (best-effort, non-blocking).
	if s.referralService != nil && order != nil {
		// Convert order total to USD for point calculation.
		// The order total is in fiat (NGN); we use the crypto price in USD.
		// For simplicity, use the crypto market price to derive USD volume:
		// volumeUSD = amount (crypto) × market_price_usd
		var volumeUSD decimal.Decimal
		if s.priceService != nil {
			var currency models.Currency
			if err := database.GetDB().Where("symbol = ?", order.Currency).First(&currency).Error; err == nil {
				if strings.TrimSpace(currency.CoinGeckoID) != "" {
					if usdPrice, err := s.priceService.GetMarketPrice(ctx, currency.CoinGeckoID, "usd"); err == nil {
						volumeUSD = order.Amount.Mul(usdPrice)
					}
				}
			}
		}

		if volumeUSD.IsPositive() {
			_ = s.referralService.AwardPointsForP2POrder(ctx, order.BuyerID, order.ID, volumeUSD)
			_ = s.referralService.AwardPointsForP2POrder(ctx, order.SellerID, order.ID, volumeUSD)
		}
	}

	if s.emailSender != nil && order != nil {
		buyerID := order.BuyerID
		sellerID := order.SellerID
		orderNum := order.OrderNumber
		crypto := emailCrypto
		qty := emailAmount
		px := emailPrice
		fiat := emailFiatTotal
		go func() {
			date := time.Now().UTC().Format("02 Jan 2006, 15:04 UTC")
			var buyer, seller models.User
			if err := database.GetDB().Select("email, first_name").Where("id = ?", buyerID).First(&buyer).Error; err != nil {
				logger.Warn("p2p trade email: failed to load buyer", zap.String("user_id", buyerID.String()), zap.Error(err))
				return
			}
			if err := database.GetDB().Select("email, first_name").Where("id = ?", sellerID).First(&seller).Error; err != nil {
				logger.Warn("p2p trade email: failed to load seller", zap.String("user_id", sellerID.String()), zap.Error(err))
				return
			}
			buyHTML := emailclient.P2PTradeBuyEmailHTML(
				buyer.FirstName, qty.String(), crypto,
				px.StringFixed(2), fiat.StringFixed(2),
				seller.FirstName, orderNum, date,
			)
			if err := s.emailSender.SendOTP(buyer.Email, "Trade Completed – Buy "+crypto, buyHTML); err != nil {
				logger.Warn("p2p buy email: send failed", zap.String("email", buyer.Email), zap.Error(err))
			}
			sellHTML := emailclient.P2PTradeSellEmailHTML(
				seller.FirstName, qty.String(), crypto,
				px.StringFixed(2), fiat.StringFixed(2),
				buyer.FirstName, orderNum, date,
			)
			if err := s.emailSender.SendOTP(seller.Email, "Trade Completed – Sell "+crypto, sellHTML); err != nil {
				logger.Warn("p2p sell email: send failed", zap.String("email", seller.Email), zap.Error(err))
			}
		}()
	}

	return order, nil
}

func (s *p2pService) GetTopTraders(currency string, page, pageSize int) ([]TopTrader, int64, error) {
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	if page <= 0 {
		page = 1
	}

	rows, total, err := s.adRepo.GetTopTraders(currency, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	// Collect user IDs for the current page.
	userIDs := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		userIDs = append(userIDs, row.UserID)
	}

	// Fetch per-currency crypto volume for this page of users.
	volumeRows, err := s.adRepo.GetTraderVolumes(userIDs, currency)
	if err != nil {
		return nil, 0, err
	}

	// Build a lookup: userID → currency → volume (fiat truncated to 2dp).
	volumeMap := make(map[uuid.UUID]map[string]decimal.Decimal, len(userIDs))
	for _, v := range volumeRows {
		if volumeMap[v.UserID] == nil {
			volumeMap[v.UserID] = make(map[string]decimal.Decimal)
		}
		volumeMap[v.UserID][v.Currency] = utils.TruncateIfFiat(v.Volume, v.Currency)
	}

	traders := make([]TopTrader, 0, len(rows))
	for _, row := range rows {
		trader := TopTrader{
			CompletedTrades:  row.CompletedTrades,
			VolumeByCurrency: volumeMap[row.UserID],
			LastTradeAt:      row.LastTradeAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		var u models.User
		if err := database.GetDB().Preload("Profile").First(&u, "id = ?", row.UserID).Error; err == nil {
			trader.User = u.ToResponse()
		}
		traders = append(traders, trader)
	}

	return traders, total, nil
}
