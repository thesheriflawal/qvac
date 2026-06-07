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

type WalletService interface {
	GetOrCreateAddress(ctx context.Context, userID uuid.UUID, chainKey, networkType, currencySymbol string) (*models.CryptoAddress, bool, error)
	ListUserWallets(ctx context.Context, userID uuid.UUID) ([]models.WalletResponse, error)
	ListUserWalletTransactions(ctx context.Context, userID uuid.UUID, currency string, page, pageSize int) ([]models.WalletTransaction, int64, error)
	InternalTransfer(ctx context.Context, senderID uuid.UUID, receiverUID, receiverEmail string, currencyID uuid.UUID, pin, authCode string, amount decimal.Decimal) (*models.InternalTransfer, error)
	CryptoWithdraw(ctx context.Context, userID uuid.UUID, chainKey, networkType, currencySymbol, address, pin, authCode, note string, amount decimal.Decimal) (*models.CryptoWithdrawal, error)
	ListUserTransactionHistory(ctx context.Context, userID uuid.UUID, currency string, page, pageSize int) ([]models.TransactionHistoryItem, int64, error)
	ReconcilePendingWithdrawals(ctx context.Context) error
}

type walletService struct {
	cryptoAddrRepo repository.CryptoAddressRepository
	networkRepo    repository.NetworkRepository
	currencyRepo   repository.CurrencyRepository
	walletRepo     repository.WalletRepository
	userRepo       repository.UserRepository
	feeService     FeeService
	limitService   WithdrawalLimitService
	priceService   PriceService
	emailSender    emailclient.Sender
}

func NewWalletService(
	userRepo repository.UserRepository,
	cryptoAddrRepo repository.CryptoAddressRepository,
	networkRepo repository.NetworkRepository,
	currencyRepo repository.CurrencyRepository,
	walletRepo repository.WalletRepository,
	feeService FeeService,
	limitService WithdrawalLimitService,
	priceService PriceService,
	emailSender emailclient.Sender,
) WalletService {
	return &walletService{
		userRepo:       userRepo,
		cryptoAddrRepo: cryptoAddrRepo,
		networkRepo:    networkRepo,
		currencyRepo:   currencyRepo,
		walletRepo:     walletRepo,
		feeService:     feeService,
		limitService:   limitService,
		priceService:   priceService,
		emailSender:    emailSender,
	}
}

// GetOrCreateAddress is not available in this version (no custodial wallet provider).
func (s *walletService) GetOrCreateAddress(_ context.Context, _ uuid.UUID, _, _, _ string) (*models.CryptoAddress, bool, error) {
	return nil, false, utils.NewSafeError("crypto deposits are not available in this version")
}

func (s *walletService) ListUserWallets(ctx context.Context, userID uuid.UUID) ([]models.WalletResponse, error) {
	if s.walletRepo == nil {
		return nil, utils.NewSafeError("wallet repository not configured")
	}
	wallets, err := s.walletRepo.ListByUser(userID)
	if err != nil {
		return nil, err
	}
	responses := make([]models.WalletResponse, len(wallets))
	for i := range wallets {
		responses[i] = wallets[i].ToResponse()
	}
	return responses, nil
}

func (s *walletService) ListUserWalletTransactions(ctx context.Context, userID uuid.UUID, currency string, page, pageSize int) ([]models.WalletTransaction, int64, error) {
	if s.walletRepo == nil {
		return nil, 0, utils.NewSafeError("wallet repository not configured")
	}
	return s.walletRepo.ListTransactionsByUser(userID, currency, page, pageSize)
}

func (s *walletService) InternalTransfer(ctx context.Context, senderID uuid.UUID, receiverUID, receiverEmail string, currencyID uuid.UUID, pin, authCode string, amount decimal.Decimal) (*models.InternalTransfer, error) {
	if s.userRepo == nil {
		return nil, utils.NewSafeError("user repository not configured")
	}
	if s.currencyRepo == nil {
		return nil, utils.NewSafeError("currency repository not configured")
	}

	receiverUID = strings.TrimSpace(receiverUID)
	receiverEmail = strings.TrimSpace(strings.ToLower(receiverEmail))
	pin = strings.TrimSpace(pin)
	authCode = strings.TrimSpace(authCode)

	if senderID == uuid.Nil {
		return nil, utils.NewSafeError("invalid sender")
	}
	if receiverUID == "" && receiverEmail == "" {
		return nil, utils.NewSafeError("receiver_uid or receiver_email is required")
	}
	if currencyID == uuid.Nil {
		return nil, utils.NewSafeError("currency_id is required")
	}
	if amount.LessThanOrEqual(decimal.Zero) {
		return nil, utils.NewSafeError("amount must be greater than zero")
	}
	if amount.LessThan(decimal.NewFromFloat(0.00000001)) {
		return nil, utils.NewSafeError("amount is below the minimum transfer threshold")
	}
	if pin == "" {
		return nil, utils.NewSafeError("pin is required")
	}

	cur, cerr := s.currencyRepo.FindByID(currencyID)
	if cerr != nil {
		if errors.Is(cerr, gorm.ErrRecordNotFound) {
			return nil, utils.NewSafeError("unsupported currency")
		}
		return nil, cerr
	}
	amount = amount.Truncate(int32(cur.Decimals))
	currency := strings.ToUpper(strings.TrimSpace(cur.Symbol))
	if currency == "" {
		return nil, utils.NewSafeError("currency symbol not configured")
	}

	if err := verifyUserPinAndAuthenticator(senderID, pin, authCode); err != nil {
		return nil, err
	}

	var receiver *models.User
	var err error

	if receiverUID != "" {
		receiver, err = s.userRepo.FindByUID(receiverUID)
	} else {
		receiver, err = s.userRepo.FindByEmail(receiverEmail)
	}
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.NewSafeError("receiver not found")
		}
		return nil, err
	}

	if receiver.ID == senderID {
		return nil, utils.NewSafeError("cannot transfer to yourself")
	}

	var transfer *models.InternalTransfer

	if err := database.Transaction(func(tx *gorm.DB) error {
		tx = tx.WithContext(ctx)

		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&models.Wallet{
			UserID:     receiver.ID,
			CurrencyID: cur.ID,
			Currency:   currency,
		}).Error; err != nil {
			return err
		}

		var senderWallet, receiverWallet models.Wallet
		if err := tx.Where("user_id = ? AND currency = ?", senderID, currency).First(&senderWallet).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return utils.NewSafeError("insufficient balance")
			}
			return err
		}
		if err := tx.Where("user_id = ? AND currency = ?", receiver.ID, currency).First(&receiverWallet).Error; err != nil {
			return err
		}

		if senderWallet.ID.String() <= receiverWallet.ID.String() {
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", senderWallet.ID).First(&senderWallet).Error; err != nil {
				return err
			}
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", receiverWallet.ID).First(&receiverWallet).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", receiverWallet.ID).First(&receiverWallet).Error; err != nil {
				return err
			}
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", senderWallet.ID).First(&senderWallet).Error; err != nil {
				return err
			}
		}

		amtUnits := utils.ToStorageUnits(amount, cur.Decimals)
		if senderWallet.Balance-senderWallet.LockedBalance < amtUnits {
			return utils.NewSafeError("insufficient balance")
		}

		balanceBeforeSender := utils.FromStorageUnits(senderWallet.Balance, cur.Decimals)
		balanceBeforeReceiver := utils.FromStorageUnits(receiverWallet.Balance, cur.Decimals)

		if err := tx.Model(&senderWallet).Update("balance", gorm.Expr("balance - ?", amtUnits)).Error; err != nil {
			return err
		}
		balanceAfterSender := balanceBeforeSender.Sub(amount)

		if err := tx.Model(&receiverWallet).Update("balance", gorm.Expr("balance + ?", amtUnits)).Error; err != nil {
			return err
		}
		balanceAfterReceiver := balanceBeforeReceiver.Add(amount)

		t := &models.InternalTransfer{
			SenderID:   senderID,
			ReceiverID: receiver.ID,
			Currency:   currency,
			Amount:     amount,
			Status:     "completed",
		}
		if err := tx.Create(t).Error; err != nil {
			return err
		}

		refID := fmt.Sprintf("internal_transfer:%s", t.ID.String())

		senderTx := &models.WalletTransaction{
			WalletID:      senderWallet.ID,
			Type:          "Internal Transfer",
			Amount:        amount,
			BalanceBefore: balanceBeforeSender,
			BalanceAfter:  balanceAfterSender,
			ReferenceID:   refID,
			Description:   "Internal transfer sent",
		}
		if err := tx.Create(senderTx).Error; err != nil {
			return err
		}

		receiverTx := &models.WalletTransaction{
			WalletID:      receiverWallet.ID,
			Type:          "Internal Received",
			Amount:        amount,
			BalanceBefore: balanceBeforeReceiver,
			BalanceAfter:  balanceAfterReceiver,
			ReferenceID:   refID,
			Description:   "Internal transfer received",
		}
		if err := tx.Create(receiverTx).Error; err != nil {
			return err
		}

		transfer = t
		return nil
	}); err != nil {
		return nil, err
	}

	if s.emailSender != nil && transfer != nil {
		sid := senderID
		recv := receiver
		amt := transfer.Amount
		cur := transfer.Currency
		ref := fmt.Sprintf("internal_transfer:%s", transfer.ID.String())
		go func() {
			var sender models.User
			if err := database.GetDB().Select("email, first_name").Where("id = ?", sid).First(&sender).Error; err != nil {
				logger.Warn("internal transfer email: failed to load sender", zap.String("user_id", sid.String()), zap.Error(err))
				return
			}
			date := time.Now().UTC().Format("02 Jan 2006, 15:04 UTC")
			sentHTML := emailclient.InternalTransferSentEmailHTML(sender.FirstName, amt.String(), cur, recv.FirstName, recv.Email, ref, date)
			if err := s.emailSender.SendOTP(sender.Email, "Transfer Sent – "+cur, sentHTML); err != nil {
				logger.Warn("internal transfer sent email: send failed", zap.String("user_id", sid.String()), zap.Error(err))
			}
			recvHTML := emailclient.InternalTransferReceivedEmailHTML(recv.FirstName, amt.String(), cur, sender.FirstName, sender.Email, ref, date)
			if err := s.emailSender.SendOTP(recv.Email, "Transfer Received – "+cur, recvHTML); err != nil {
				logger.Warn("internal transfer received email: send failed", zap.String("email", recv.Email), zap.Error(err))
			}
		}()
	}

	return transfer, nil
}

// CryptoWithdraw is not available in this version (no custodial wallet provider).
func (s *walletService) CryptoWithdraw(_ context.Context, _ uuid.UUID, _, _, _, _, _, _, _ string, _ decimal.Decimal) (*models.CryptoWithdrawal, error) {
	return nil, utils.NewSafeError("crypto withdrawals are not available in this version")
}

// ReconcilePendingWithdrawals is a no-op (no external withdrawal provider).
func (s *walletService) ReconcilePendingWithdrawals(_ context.Context) error {
	return nil
}

