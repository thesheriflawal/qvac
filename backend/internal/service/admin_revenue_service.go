package service

import (
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
)

// RevenueSummary bundles the data returned by GET /admin/revenue/summary.
type RevenueSummary struct {
	FeeBalances []models.PlatformFeeBalance `json:"fee_balances"`
	OrderStats  *repository.OrderStats      `json:"order_stats"`
}

// AdminRevenueService provides admin revenue reporting operations.
type AdminRevenueService interface {
	GetSummary(from, to time.Time) (*RevenueSummary, error)
	GetDailyFees(from, to time.Time, currency string) ([]repository.DailyFeeRow, error)
}

type adminRevenueService struct {
	revenueRepo repository.RevenueRepository
}

// NewAdminRevenueService creates a new AdminRevenueService.
func NewAdminRevenueService(revenueRepo repository.RevenueRepository) AdminRevenueService {
	return &adminRevenueService{revenueRepo: revenueRepo}
}

func (s *adminRevenueService) GetSummary(from, to time.Time) (*RevenueSummary, error) {
	balances, err := s.revenueRepo.GetPlatformFeeBalances()
	if err != nil {
		return nil, err
	}

	stats, err := s.revenueRepo.GetOrderStats(from, to)
	if err != nil {
		return nil, err
	}

	return &RevenueSummary{
		FeeBalances: balances,
		OrderStats:  stats,
	}, nil
}

func (s *adminRevenueService) GetDailyFees(from, to time.Time, currency string) ([]repository.DailyFeeRow, error) {
	return s.revenueRepo.GetDailyFees(from, to, currency)
}
