package logger

import (
	"context"
	"os"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type contextKey struct{}

// ContextWithRequestID stores the request ID in a plain context.Context so it
// can be retrieved by FromCtx in service and client layers.
func ContextWithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, contextKey{}, requestID)
}

// FromCtx returns a logger with the request ID attached, extracted from a
// plain context.Context. Falls back to the global logger if none is set.
func FromCtx(ctx context.Context) *zap.Logger {
	if ctx == nil {
		return Log
	}
	if id, ok := ctx.Value(contextKey{}).(string); ok && id != "" {
		return WithRequestID(id)
	}
	return Log
}

const requestIDKey = "X-Request-ID"

var Log *zap.Logger

// Initialize sets up the logger based on environment
func Initialize(level, format string) error {
	var config zap.Config

	if format == "console" {
		config = zap.NewDevelopmentConfig()
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	} else {
		config = zap.NewProductionConfig()
	}

	// Set log level
	var zapLevel zapcore.Level
	if err := zapLevel.UnmarshalText([]byte(level)); err != nil {
		zapLevel = zapcore.InfoLevel
	}
	config.Level = zap.NewAtomicLevelAt(zapLevel)

	// Build logger
	logger, err := config.Build(zap.AddCallerSkip(1))
	if err != nil {
		return err
	}

	Log = logger
	return nil
}

// Info logs an info message
func Info(msg string, fields ...zap.Field) {
	Log.Info(msg, fields...)
}

// Error logs an error message
func Error(msg string, fields ...zap.Field) {
	Log.Error(msg, fields...)
}

// Debug logs a debug message
func Debug(msg string, fields ...zap.Field) {
	Log.Debug(msg, fields...)
}

// Warn logs a warning message
func Warn(msg string, fields ...zap.Field) {
	Log.Warn(msg, fields...)
}

// Fatal logs a fatal message and exits
func Fatal(msg string, fields ...zap.Field) {
	Log.Fatal(msg, fields...)
	os.Exit(1)
}

// WithRequestID returns a logger with the given request ID attached.
func WithRequestID(requestID string) *zap.Logger {
	if requestID == "" {
		return Log
	}
	return Log.With(zap.String("request_id", requestID))
}

// Ctx returns a logger with the request ID extracted from the Gin context.
// Use this in handlers: logger.Ctx(c).Info("something happened")
func Ctx(c *gin.Context) *zap.Logger {
	if id, ok := c.Get(requestIDKey); ok {
		if s, ok := id.(string); ok {
			return WithRequestID(s)
		}
	}
	return Log
}

// Sync flushes any buffered log entries
func Sync() {
	if Log != nil {
		_ = Log.Sync()
	}
}
