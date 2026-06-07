package utils

import (
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

var validate *validator.Validate

// InitValidator initializes the validator
func InitValidator() {
	validate = validator.New()
}

// GetValidator returns the validator instance
func GetValidator() *validator.Validate {
	if validate == nil {
		InitValidator()
	}
	return validate
}

// ValidateStruct validates a struct and returns formatted errors
func ValidateStruct(s interface{}) error {
	return GetValidator().Struct(s)
}

// FormatValidationErrors formats validation errors into a readable map
func FormatValidationErrors(err error) map[string]string {
	errors := make(map[string]string)

	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		for _, e := range validationErrors {
			field := strings.ToLower(e.Field())
			errors[field] = formatFieldError(e)
		}
	}

	return errors
}

// formatFieldError formats a single field validation error
func formatFieldError(e validator.FieldError) string {
	field := e.Field()

	switch e.Tag() {
	case "required":
		return fmt.Sprintf("%s is required", field)
	case "email":
		return fmt.Sprintf("%s must be a valid email address", field)
	case "min":
		return fmt.Sprintf("%s must be at least %s characters long", field, e.Param())
	case "max":
		return fmt.Sprintf("%s must be at most %s characters long", field, e.Param())
	case "gte":
		return fmt.Sprintf("%s must be greater than or equal to %s", field, e.Param())
	case "lte":
		return fmt.Sprintf("%s must be less than or equal to %s", field, e.Param())
	case "gt":
		return fmt.Sprintf("%s must be greater than %s", field, e.Param())
	case "lt":
		return fmt.Sprintf("%s must be less than %s", field, e.Param())
	case "oneof":
		return fmt.Sprintf("%s must be one of: %s", field, e.Param())
	case "url":
		return fmt.Sprintf("%s must be a valid URL", field)
	case "uuid":
		return fmt.Sprintf("%s must be a valid UUID", field)
	default:
		return fmt.Sprintf("%s is invalid", field)
	}
}

// BindAndValidate binds request data and validates it
func BindAndValidate(c *gin.Context, obj interface{}) error {
	if err := c.ShouldBindJSON(obj); err != nil {
		return err
	}

	if err := ValidateStruct(obj); err != nil {
		return err
	}

	return nil
}
