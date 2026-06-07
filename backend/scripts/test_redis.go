package main

import (
	"fmt"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/cache"
	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
)

// Simple test script to verify Redis functionality
func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		return
	}

	// Initialize logger
	if err := logger.Initialize("info", "console"); err != nil {
		fmt.Printf("Failed to initialize logger: %v\n", err)
		return
	}

	// Initialize Redis
	fmt.Println("Connecting to Redis...")
	if err := cache.Initialize(cfg); err != nil {
		fmt.Printf("Failed to initialize Redis: %v\n", err)
		return
	}
	defer cache.Close()

	fmt.Println("✓ Redis connected successfully!")

	// Test basic operations
	fmt.Println("\nTesting basic cache operations...")

	// Test Set/Get
	key := "test:key"
	value := "Hello, Redis!"
	if err := cache.Client.Set(key, value, 5*time.Minute); err != nil {
		fmt.Printf("Failed to set key: %v\n", err)
		return
	}
	fmt.Printf("✓ Set key '%s' = '%s'\n", key, value)

	retrieved, err := cache.Client.Get(key)
	if err != nil {
		fmt.Printf("Failed to get key: %v\n", err)
		return
	}
	fmt.Printf("✓ Retrieved value: '%s'\n", retrieved)

	// Test JSON operations
	type User struct {
		ID    int    `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}

	user := User{ID: 1, Name: "John Doe", Email: "john@example.com"}
	jsonKey := "test:user:1"

	if err := cache.Client.SetJSON(jsonKey, user, 5*time.Minute); err != nil {
		fmt.Printf("Failed to set JSON: %v\n", err)
		return
	}
	fmt.Printf("✓ Stored user object as JSON\n")

	var retrievedUser User
	if err := cache.Client.GetJSON(jsonKey, &retrievedUser); err != nil {
		fmt.Printf("Failed to get JSON: %v\n", err)
		return
	}
	fmt.Printf("✓ Retrieved user: %+v\n", retrievedUser)

	// Test Exists
	exists, err := cache.Client.Exists(key)
	if err != nil {
		fmt.Printf("Failed to check existence: %v\n", err)
		return
	}
	fmt.Printf("✓ Key exists: %v\n", exists)

	// Test Delete
	if err := cache.Client.Delete(key, jsonKey); err != nil {
		fmt.Printf("Failed to delete keys: %v\n", err)
		return
	}
	fmt.Printf("✓ Deleted test keys\n")

	// Test Increment
	counterKey := "test:counter"
	count, err := cache.Client.Increment(counterKey)
	if err != nil {
		fmt.Printf("Failed to increment: %v\n", err)
		return
	}
	fmt.Printf("✓ Counter incremented to: %d\n", count)

	// Clean up
	cache.Client.Delete(counterKey)

	fmt.Println("\n✅ All Redis operations completed successfully!")
}
