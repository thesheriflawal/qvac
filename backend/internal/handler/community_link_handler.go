package handler

import (
	"net/http"
	"strings"

	"github.com/Kynettic-org/kynettic-backend/internal/models"
	"github.com/Kynettic-org/kynettic-backend/internal/repository"
	"github.com/Kynettic-org/kynettic-backend/internal/utils"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type CommunityLinkHandler struct {
	repo repository.CommunityLinkRepository
}

func NewCommunityLinkHandler(repo repository.CommunityLinkRepository) *CommunityLinkHandler {
	return &CommunityLinkHandler{repo: repo}
}

type UpsertCommunityLinkRequest struct {
	Platform string `json:"platform" binding:"required"`
	URL      string `json:"url"      binding:"required,url"`
	Label    string `json:"label"`
}

// UpsertLink creates or updates a community link.
// @Summary Upsert community link
// @Description Admin-only: add or update a community link (upsert by platform).
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body UpsertCommunityLinkRequest true "Community link"
// @Success 200 {object} utils.Response{data=models.CommunityLink}
// @Failure 400 {object} utils.Response
// @Failure 401 {object} utils.Response
// @Failure 403 {object} utils.Response
// @Router /admin/community-links [post]
func (h *CommunityLinkHandler) UpsertLink(c *gin.Context) {
	var req UpsertCommunityLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.ValidationErrorResponse(c, err.Error())
		return
	}

	link := &models.CommunityLink{
		Platform: strings.ToLower(strings.TrimSpace(req.Platform)),
		URL:      strings.TrimSpace(req.URL),
		Label:    strings.TrimSpace(req.Label),
	}

	if err := h.repo.Upsert(link); err != nil {
		logger.Ctx(c).Error("Community link upsert failed",
			zap.String("platform", link.Platform),
			zap.Error(err),
		)
		utils.ErrorResponse(c, http.StatusInternalServerError, utils.SanitizeServiceError(err), nil)
		return
	}

	logger.Ctx(c).Info("Community link saved", zap.String("platform", link.Platform))
	utils.SuccessResponse(c, http.StatusOK, "Community link saved", link)
}

// ListLinks returns all community links.
// @Summary List community links
// @Description Returns all community links. Requires authentication.
// @Tags community
// @Produce json
// @Security BearerAuth
// @Success 200 {object} utils.Response{data=[]models.CommunityLink}
// @Failure 401 {object} utils.Response
// @Router /community-links [get]
func (h *CommunityLinkHandler) ListLinks(c *gin.Context) {
	links, err := h.repo.ListAll()
	if err != nil {
		logger.Ctx(c).Error("Community link list failed", zap.Error(err))
		utils.ServiceErrorResponse(c, err)
		return
	}

	utils.SuccessResponse(c, http.StatusOK, "Community links retrieved", links)
}
