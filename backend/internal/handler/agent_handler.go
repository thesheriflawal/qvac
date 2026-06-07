package handler

import (
	"net/http"
	"strconv"

	"github.com/Kynettic-org/kynettic-backend/internal/middleware"
	"github.com/Kynettic-org/kynettic-backend/internal/service"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AgentHandler handles AI trading agent endpoints.
type AgentHandler struct {
	agentService service.AIAgentService
}

// NewAgentHandler constructs an AgentHandler.
func NewAgentHandler(agentService service.AIAgentService) *AgentHandler {
	return &AgentHandler{agentService: agentService}
}

type createAgentRequest struct {
	Name         string   `json:"name"          binding:"required,min=1,max=100"`
	Description  string   `json:"description"`
	RiskLevel    string   `json:"risk_level"`
	MaxSpendUSD  float64  `json:"max_spend_usd"`
	TargetAssets []string `json:"target_assets"`
	AutoExecute  bool     `json:"auto_execute"`
	CycleSeconds int      `json:"cycle_seconds"`
}

type updateStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type submitDecisionRequest struct {
	Action      string  `json:"action"       binding:"required"`
	Asset       string  `json:"asset"`
	AmountUSD   float64 `json:"amount_usd"`
	Reasoning   string  `json:"reasoning"`
	ContextJSON string  `json:"context_json"`
}

// CreateAgent godoc
// @Summary Create an AI trading agent
// @Tags agents
// @Accept json
// @Produce json
// @Success 201 {object} map[string]interface{}
// @Router /agents [post]
func (h *AgentHandler) CreateAgent(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	var req createAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	agent, err := h.agentService.CreateAgent(c.Request.Context(), claims.UserID, service.CreateAgentInput{
		Name:         req.Name,
		Description:  req.Description,
		RiskLevel:    req.RiskLevel,
		MaxSpendUSD:  req.MaxSpendUSD,
		TargetAssets: req.TargetAssets,
		AutoExecute:  req.AutoExecute,
		CycleSeconds: req.CycleSeconds,
	})
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusCreated, "agent created", agent)
}

// ListAgents godoc
// @Summary List all AI agents for the authenticated user
// @Tags agents
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /agents [get]
func (h *AgentHandler) ListAgents(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	agents, err := h.agentService.ListAgents(c.Request.Context(), claims.UserID)
	if err != nil {
		utils.ErrorResponse(c, http.StatusInternalServerError, "failed to list agents", nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "agents retrieved", agents)
}

// GetAgent godoc
// @Summary Get a single AI agent
// @Tags agents
// @Produce json
// @Param id path string true "Agent ID"
// @Success 200 {object} map[string]interface{}
// @Router /agents/{id} [get]
func (h *AgentHandler) GetAgent(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	agentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "invalid agent id", nil)
		return
	}

	agent, err := h.agentService.GetAgent(c.Request.Context(), claims.UserID, agentID)
	if err != nil {
		utils.ErrorResponse(c, http.StatusNotFound, err.Error(), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "agent retrieved", agent)
}

// UpdateAgentStatus godoc
// @Summary Pause, resume, or terminate an AI agent
// @Tags agents
// @Accept json
// @Produce json
// @Param id path string true "Agent ID"
// @Success 200 {object} map[string]interface{}
// @Router /agents/{id}/status [patch]
func (h *AgentHandler) UpdateAgentStatus(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	agentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "invalid agent id", nil)
		return
	}

	var req updateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	agent, err := h.agentService.UpdateAgentStatus(c.Request.Context(), claims.UserID, agentID, req.Status)
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "agent status updated", agent)
}

// GetMarketContext godoc
// @Summary Get current market context for a QVAC inference cycle
// @Tags agents
// @Produce json
// @Param id path string true "Agent ID"
// @Success 200 {object} map[string]interface{}
// @Router /agents/{id}/context [get]
func (h *AgentHandler) GetMarketContext(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	agentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "invalid agent id", nil)
		return
	}

	ctx, err := h.agentService.GetMarketContext(c.Request.Context(), claims.UserID, agentID)
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "market context retrieved", ctx)
}

// SubmitDecision godoc
// @Summary Submit a decision produced by the client-side QVAC model
// @Tags agents
// @Accept json
// @Produce json
// @Param id path string true "Agent ID"
// @Success 201 {object} map[string]interface{}
// @Router /agents/{id}/decisions [post]
func (h *AgentHandler) SubmitDecision(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	agentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "invalid agent id", nil)
		return
	}

	var req submitDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	decision, err := h.agentService.SubmitDecision(c.Request.Context(), claims.UserID, agentID, service.SubmitDecisionInput{
		Action:      req.Action,
		Asset:       req.Asset,
		AmountUSD:   req.AmountUSD,
		Reasoning:   req.Reasoning,
		ContextJSON: req.ContextJSON,
	})
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusCreated, "decision submitted", decision)
}

// ListDecisions godoc
// @Summary List AI decision history for an agent
// @Tags agents
// @Produce json
// @Param id path string true "Agent ID"
// @Success 200 {object} map[string]interface{}
// @Router /agents/{id}/decisions [get]
func (h *AgentHandler) ListDecisions(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	agentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "invalid agent id", nil)
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	decisions, total, err := h.agentService.ListDecisions(c.Request.Context(), claims.UserID, agentID, page, pageSize)
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, err.Error(), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "decisions retrieved", gin.H{
		"decisions": decisions,
		"pagination": gin.H{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

// GetPerformanceSummary godoc
// @Summary Get performance summary for an AI agent
// @Tags agents
// @Produce json
// @Param id path string true "Agent ID"
// @Success 200 {object} map[string]interface{}
// @Router /agents/{id}/performance [get]
func (h *AgentHandler) GetPerformanceSummary(c *gin.Context) {
	claims, err := middleware.GetUserFromContext(c)
	if err != nil {
		utils.ErrorResponse(c, http.StatusUnauthorized, "unauthorized", nil)
		return
	}

	agentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		utils.ErrorResponse(c, http.StatusBadRequest, "invalid agent id", nil)
		return
	}

	summary, err := h.agentService.GetPerformanceSummary(c.Request.Context(), claims.UserID, agentID)
	if err != nil {
		utils.ErrorResponse(c, http.StatusNotFound, err.Error(), nil)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "performance summary retrieved", summary)
}
