package service

import (
	"context"
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ListUserTransactionHistory returns enriched, paginated transaction history
// for the given user. Each WalletTransaction is resolved against its source
// record (internal transfer, crypto deposit/withdrawal, fiat deposit/withdrawal,
// P2P order, etc.) so the response includes status, counterparty, fees, and
// type-specific details.
func (s *walletService) ListUserTransactionHistory(ctx context.Context, userID uuid.UUID, currency string, page, pageSize int) ([]models.TransactionHistoryItem, int64, error) {
	txs, total, err := s.walletRepo.ListTransactionsByUser(userID, currency, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	if len(txs) == 0 {
		return []models.TransactionHistoryItem{}, total, nil
	}

	// Collect reference IDs grouped by prefix so we can batch-load source records.
	var (
		internalTransferIDs []uuid.UUID
		cryptoWithdrawalIDs []uuid.UUID
		fiatWithdrawalIDs   []uuid.UUID
		p2pOrderIDs         []uuid.UUID
		cryptoDepositHashes []string // raw tx hashes (no prefix)
		fiatDepositRefs     []string // raw Nomba transaction IDs (no prefix)
	)

	for i := range txs {
		ref := txs[i].ReferenceID
		typ := txs[i].Type

		switch {
		case strings.HasPrefix(ref, "internal_transfer:"):
			if id, err := uuid.Parse(strings.TrimPrefix(ref, "internal_transfer:")); err == nil {
				internalTransferIDs = append(internalTransferIDs, id)
			}
		case strings.HasPrefix(ref, "crypto_withdrawal:"):
			if id, err := uuid.Parse(strings.TrimPrefix(ref, "crypto_withdrawal:")); err == nil {
				cryptoWithdrawalIDs = append(cryptoWithdrawalIDs, id)
			}
		case strings.HasPrefix(ref, "fiat_withdrawal:"):
			if id, err := uuid.Parse(strings.TrimPrefix(ref, "fiat_withdrawal:")); err == nil {
				fiatWithdrawalIDs = append(fiatWithdrawalIDs, id)
			}
		case strings.HasPrefix(ref, "p2p_order:"):
			if id, err := uuid.Parse(strings.TrimPrefix(ref, "p2p_order:")); err == nil {
				p2pOrderIDs = append(p2pOrderIDs, id)
			}
		default:
			// Deposits don't have a prefix. Distinguish fiat vs crypto by
			// the wallet currency populated from the JOIN.
			cur := strings.ToUpper(strings.TrimSpace(txs[i].Currency))
			if utils.IsFiatCurrency(cur) {
				fiatDepositRefs = append(fiatDepositRefs, ref)
			} else if typ == "deposit" || typ == "External Deposit" {
				cryptoDepositHashes = append(cryptoDepositHashes, ref)
			}
		}
	}

	db := s.walletRepo.GetDB().WithContext(ctx)

	// Batch-load source records into lookup maps.
	internalTransfers := batchLoadInternalTransfers(db, internalTransferIDs)
	cryptoWithdrawals := batchLoadCryptoWithdrawals(db, cryptoWithdrawalIDs)
	fiatWithdrawals := batchLoadFiatWithdrawals(db, fiatWithdrawalIDs)
	p2pOrders := batchLoadP2POrders(db, p2pOrderIDs)
	cryptoDeposits := batchLoadCryptoDepositsByHash(db, cryptoDepositHashes)
	fiatDeposits := batchLoadFiatDepositsByRef(db, fiatDepositRefs)

	// Collect user IDs from internal transfers for counterparty info.
	userIDSet := map[uuid.UUID]struct{}{}
	for _, t := range internalTransfers {
		userIDSet[t.SenderID] = struct{}{}
		userIDSet[t.ReceiverID] = struct{}{}
	}
	// Also collect buyer/seller from P2P orders.
	for _, o := range p2pOrders {
		userIDSet[o.BuyerID] = struct{}{}
		userIDSet[o.SellerID] = struct{}{}
	}
	users := batchLoadUsers(db, userIDSet)

	// Map each WalletTransaction → TransactionHistoryItem.
	items := make([]models.TransactionHistoryItem, 0, len(txs))
	for i := range txs {
		items = append(items, enrichTransaction(&txs[i], userID, internalTransfers, cryptoWithdrawals, fiatWithdrawals, p2pOrders, cryptoDeposits, fiatDeposits, users))
	}

	return items, total, nil
}

// ---------------------------------------------------------------------------
// enrichTransaction maps a single WalletTransaction to an enriched DTO.
// ---------------------------------------------------------------------------

func enrichTransaction(
	wt *models.WalletTransaction,
	currentUserID uuid.UUID,
	internalTransfers map[uuid.UUID]models.InternalTransfer,
	cryptoWithdrawals map[uuid.UUID]models.CryptoWithdrawal,
	fiatWithdrawals map[uuid.UUID]models.FiatWithdrawal,
	p2pOrders map[uuid.UUID]models.P2POrder,
	cryptoDeposits map[string]models.CryptoDeposit,
	fiatDeposits map[string]models.FiatDeposit,
	users map[uuid.UUID]models.User,
) models.TransactionHistoryItem {
	cur := strings.ToUpper(strings.TrimSpace(wt.Currency))
	item := models.TransactionHistoryItem{
		ID:            wt.ID,
		Type:          wt.Type,
		Amount:        utils.TruncateIfFiat(wt.Amount, cur),
		Currency:      wt.Currency,
		BalanceBefore: utils.TruncateIfFiat(wt.BalanceBefore, cur),
		BalanceAfter:  utils.TruncateIfFiat(wt.BalanceAfter, cur),
		Description:   wt.Description,
		CreatedAt:     wt.CreatedAt,
		Fee:           decimal.Zero,
	}

	ref := wt.ReferenceID

	switch {
	// ---- Internal transfers ----
	case strings.HasPrefix(ref, "internal_transfer:"):
		item.Method = "internal_transfer"
		if id, err := uuid.Parse(strings.TrimPrefix(ref, "internal_transfer:")); err == nil {
			if t, ok := internalTransfers[id]; ok {
				item.Status = t.Status

				// Determine counterparty based on whether current user is sender or receiver.
				var counterpartyID uuid.UUID
				if t.SenderID == currentUserID {
					counterpartyID = t.ReceiverID
				} else {
					counterpartyID = t.SenderID
				}
				if u, ok := users[counterpartyID]; ok {
					item.Counterparty = &models.CounterpartyInfo{
						Name:  strings.TrimSpace(u.FirstName + " " + u.LastName),
						UID:   u.UID,
						Email: u.Email,
					}
				}
			}
		}

	// ---- Crypto withdrawals (including refunds) ----
	case strings.HasPrefix(ref, "crypto_withdrawal:"):
		item.Method = "onchain"
		if id, err := uuid.Parse(strings.TrimPrefix(ref, "crypto_withdrawal:")); err == nil {
			if w, ok := cryptoWithdrawals[id]; ok {
				status := w.Status
				if status == "pending_verification" {
					status = "pending"
				}
				item.Status = status
				item.Fee = w.Fee
				item.Receipt = models.TransactionReceipt{
					Address: w.Address,
					TxHash:  w.TxHash,
				}
			}
		}

	// ---- Fiat withdrawals ----
	case strings.HasPrefix(ref, "fiat_withdrawal:"):
		item.Method = "bank_transfer"
		if id, err := uuid.Parse(strings.TrimPrefix(ref, "fiat_withdrawal:")); err == nil {
			if w, ok := fiatWithdrawals[id]; ok {
				item.Status = w.Status
				item.Fee = w.Fee.Truncate(2)
				item.Receipt = models.TransactionReceipt{
					BankName:      w.BankName,
					AccountNumber: w.AccountNumber,
				}
			}
		}

	// ---- P2P trades ----
	case strings.HasPrefix(ref, "p2p_order:"):
		item.Method = "p2p_trade"
		if id, err := uuid.Parse(strings.TrimPrefix(ref, "p2p_order:")); err == nil {
			if o, ok := p2pOrders[id]; ok {
				item.Status = o.Status
				item.Fee = o.MakerFeeAmount

				// Counterparty is the other side of the trade.
				var counterpartyID uuid.UUID
				if o.BuyerID == currentUserID {
					counterpartyID = o.SellerID
				} else {
					counterpartyID = o.BuyerID
				}
				if u, ok := users[counterpartyID]; ok {
					item.Counterparty = &models.CounterpartyInfo{
						Name:  strings.TrimSpace(u.FirstName + " " + u.LastName),
						UID:   u.UID,
						Email: u.Email,
					}
				}
			}
		}

	// ---- Referral rewards ----
	case strings.HasPrefix(ref, "referral_claim:"):
		item.Method = "referral_reward"
		item.Status = "completed"

	// ---- Deposits (no prefix) ----
	default:
		cur := strings.ToUpper(strings.TrimSpace(wt.Currency))
		if utils.IsFiatCurrency(cur) {
			item.Method = "bank_transfer"
			if d, ok := fiatDeposits[ref]; ok {
				item.Status = d.Status
				item.Receipt = models.TransactionReceipt{
					BankName:      d.BankName,
					AccountNumber: d.AccountNumber,
				}
			}
		} else {
			item.Method = "onchain"
			if d, ok := cryptoDeposits[ref]; ok {
				item.Status = d.Status
				item.Receipt = models.TransactionReceipt{
					TxHash:  d.TxHash,
					Network: d.Network,
				}
			}
		}
	}

	// Default status if we couldn't resolve it.
	if item.Status == "" {
		item.Status = "unknown"
	}

	return item
}

// ---------------------------------------------------------------------------
// Batch loaders
// ---------------------------------------------------------------------------

func batchLoadInternalTransfers(db *gorm.DB, ids []uuid.UUID) map[uuid.UUID]models.InternalTransfer {
	out := make(map[uuid.UUID]models.InternalTransfer, len(ids))
	if len(ids) == 0 {
		return out
	}
	var records []models.InternalTransfer
	db.Where("id IN ?", ids).Find(&records)
	for _, r := range records {
		out[r.ID] = r
	}
	return out
}

func batchLoadCryptoWithdrawals(db *gorm.DB, ids []uuid.UUID) map[uuid.UUID]models.CryptoWithdrawal {
	out := make(map[uuid.UUID]models.CryptoWithdrawal, len(ids))
	if len(ids) == 0 {
		return out
	}
	var records []models.CryptoWithdrawal
	db.Where("id IN ?", ids).Find(&records)
	for _, r := range records {
		out[r.ID] = r
	}
	return out
}

func batchLoadFiatWithdrawals(db *gorm.DB, ids []uuid.UUID) map[uuid.UUID]models.FiatWithdrawal {
	out := make(map[uuid.UUID]models.FiatWithdrawal, len(ids))
	if len(ids) == 0 {
		return out
	}
	var records []models.FiatWithdrawal
	db.Where("id IN ?", ids).Find(&records)
	for _, r := range records {
		out[r.ID] = r
	}
	return out
}

func batchLoadP2POrders(db *gorm.DB, ids []uuid.UUID) map[uuid.UUID]models.P2POrder {
	out := make(map[uuid.UUID]models.P2POrder, len(ids))
	if len(ids) == 0 {
		return out
	}
	var records []models.P2POrder
	db.Where("id IN ?", ids).Find(&records)
	for _, r := range records {
		out[r.ID] = r
	}
	return out
}

func batchLoadCryptoDepositsByHash(db *gorm.DB, hashes []string) map[string]models.CryptoDeposit {
	out := make(map[string]models.CryptoDeposit, len(hashes))
	if len(hashes) == 0 {
		return out
	}
	var records []models.CryptoDeposit
	db.Where("tx_hash IN ?", hashes).Find(&records)
	for _, r := range records {
		out[r.TxHash] = r
	}
	return out
}

func batchLoadFiatDepositsByRef(db *gorm.DB, refs []string) map[string]models.FiatDeposit {
	out := make(map[string]models.FiatDeposit, len(refs))
	if len(refs) == 0 {
		return out
	}
	var records []models.FiatDeposit
	db.Where("reference IN ?", refs).Find(&records)
	for _, r := range records {
		out[r.Reference] = r
	}
	return out
}

func batchLoadUsers(db *gorm.DB, idSet map[uuid.UUID]struct{}) map[uuid.UUID]models.User {
	out := make(map[uuid.UUID]models.User, len(idSet))
	if len(idSet) == 0 {
		return out
	}
	ids := make([]uuid.UUID, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}
	var records []models.User
	db.Select("id, uid, email, first_name, last_name").Where("id IN ?", ids).Find(&records)
	for _, r := range records {
		out[r.ID] = r
	}
	return out
}

