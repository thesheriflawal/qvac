package utils

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
)

// SafeError is an error whose message is explicitly safe to return to API
// clients. Use NewSafeError (rather than errors.New) in service code when
// you want the message to survive SanitizeServiceError unchanged.
//
// Prefer SafeError for all new service-layer errors. Existing plain errors
// are still sanitized by the blacklist fallback below.
type SafeError struct{ msg string }

func (e *SafeError) Error() string { return e.msg }

// NewSafeError creates a SafeError whose message will be forwarded to the
// client verbatim by SanitizeServiceError.
func NewSafeError(msg string) error { return &SafeError{msg: msg} }

// internalErrorPatterns is a blacklist fallback for plain errors that have
// not yet been migrated to SafeError. New service code should use
// NewSafeError instead of relying on this list.
var internalErrorPatterns = []string{
	// SQL / GORM
	"status=",
	"body=",
	"pq:",
	"ERROR:",
	"sql:",
	"record not found",
	"duplicate key",
	"violates",
	"SQLSTATE",
	// Network / infrastructure
	"dial tcp",
	"connection refused",
	"connection reset",
	"i/o timeout",
	"no such host",
	// Redis
	"oom command",
	"maxmemory",
	"redis",
	"moved ",
	"clusterdown",
	// Go runtime
	"runtime error",
	"goroutine",
	"panic:",
	// Generic external API leakage
	"http://",
	"https://",
}

// SanitizeServiceError returns a safe error message for inclusion in HTTP
// responses.
//
//   - SafeError values are returned verbatim — the service explicitly marked
//     them as safe for client consumption (whitelist path).
//   - All other errors are checked against internalErrorPatterns; any match
//     returns a generic message (blacklist fallback for legacy plain errors).
//   - Unrecognised plain errors also return the generic message, so unknown
//     infrastructure errors can never leak to clients.
func SanitizeServiceError(err error) string {
	if err == nil {
		return ""
	}

	// Whitelist path: explicitly safe errors travel through unchanged.
	var safe *SafeError
	if errors.As(err, &safe) {
		return safe.msg
	}

	// Blacklist fallback for existing plain errors.
	msg := err.Error()
	lower := strings.ToLower(msg)
	for _, pattern := range internalErrorPatterns {
		if strings.Contains(lower, strings.ToLower(pattern)) {
			return "An unexpected error occurred. Please try again."
		}
	}

	// Unknown plain error — sanitize by default to prevent accidental leakage
	// from dependencies not yet covered by the blacklist.
	return "An unexpected error occurred. Please try again."
}

// Response represents a standard API response
type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   interface{} `json:"error,omitempty"`
}

// PaginationMeta represents pagination metadata
type PaginationMeta struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalPages int   `json:"total_pages"`
	TotalItems int64 `json:"total_items"`
}

// PaginatedResponse represents a paginated API response
type PaginatedResponse struct {
	Success    bool           `json:"success"`
	Message    string         `json:"message,omitempty"`
	Data       interface{}    `json:"data"`
	Pagination PaginationMeta `json:"pagination"`
}

// SuccessResponse sends a success response
func SuccessResponse(c *gin.Context, statusCode int, message string, data interface{}) {
	c.JSON(statusCode, Response{
		Success: true,
		Message: message,
		Data:    data,
	})
}

// ErrorResponse sends an error response
func ErrorResponse(c *gin.Context, statusCode int, message string, err interface{}) {
	c.JSON(statusCode, Response{
		Success: false,
		Message: message,
		Error:   err,
	})
}

// PaginatedSuccessResponse sends a paginated success response
func PaginatedSuccessResponse(c *gin.Context, statusCode int, message string, data interface{}, pagination PaginationMeta) {
	c.JSON(statusCode, PaginatedResponse{
		Success:    true,
		Message:    message,
		Data:       data,
		Pagination: pagination,
	})
}

// ValidationErrorResponse sends a validation error response
func ValidationErrorResponse(c *gin.Context, errors interface{}) {
	ErrorResponse(c, 400, "Validation failed", errors)
}

// UnauthorizedResponse sends an unauthorized response
func UnauthorizedResponse(c *gin.Context, message string) {
	ErrorResponse(c, 401, message, nil)
}

// ForbiddenResponse sends a forbidden response
func ForbiddenResponse(c *gin.Context, message string) {
	ErrorResponse(c, 403, message, nil)
}

// NotFoundResponse sends a not found response
func NotFoundResponse(c *gin.Context, message string) {
	ErrorResponse(c, 404, message, nil)
}

// InternalServerErrorResponse sends an internal server error response
func InternalServerErrorResponse(c *gin.Context, message string) {
	ErrorResponse(c, 500, message, nil)
}

// ServiceErrorResponse sends an error response with the sanitized service error message.
// The HTTP status is 500 for infrastructure errors; use this when the status code is
// always 500 but the message should come from the service when it is safe to do so.
func ServiceErrorResponse(c *gin.Context, err error) {
	ErrorResponse(c, 500, SanitizeServiceError(err), nil)
}

// CalculatePagination calculates pagination metadata
func CalculatePagination(page, pageSize int, totalItems int64) PaginationMeta {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}

	totalPages := int(totalItems) / pageSize
	if int(totalItems)%pageSize > 0 {
		totalPages++
	}

	return PaginationMeta{
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
		TotalItems: totalItems,
	}
}
