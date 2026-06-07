package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/Kynettic-org/kynettic-backend/internal/config"
	"github.com/Kynettic-org/kynettic-backend/pkg/logger"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// ErrKeyNotFound is returned by Get/GetJSON when the key does not exist in Redis.
var ErrKeyNotFound = errors.New("key not found")

// IsNotFound reports whether err was caused by a missing Redis key.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrKeyNotFound)
}

// redisOpTimeout is the maximum time any single Redis command may block.
// It prevents a stalled Redis server from tying up goroutines indefinitely.
const redisOpTimeout = 5 * time.Second

var Client *RedisClient

// RedisClient wraps the Redis client with helper methods
type RedisClient struct {
	client *redis.Client
}

// ctx returns a context with a per-operation timeout so that no Redis call
// can block a goroutine indefinitely if the server becomes unresponsive.
func (r *RedisClient) ctx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), redisOpTimeout)
}

// Initialize creates a new Redis client and tests the connection
func Initialize(cfg *config.Config) error {
	if !cfg.Redis.Enabled {
		logger.Info("Redis is disabled")
		return nil
	}

	// Create Redis client
	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.Redis.Host, cfg.Redis.Port),
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	// Test connection
	pingCtx, cancel := context.WithTimeout(context.Background(), redisOpTimeout)
	defer cancel()
	if err := rdb.Ping(pingCtx).Err(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	Client = &RedisClient{
		client: rdb,
	}

	logger.Info("Redis connected successfully",
		zap.String("host", cfg.Redis.Host),
		zap.String("port", cfg.Redis.Port),
		zap.Int("db", cfg.Redis.DB),
	)

	return nil
}

// Close closes the Redis connection
func Close() error {
	if Client != nil && Client.client != nil {
		return Client.client.Close()
	}
	return nil
}

// HealthCheck checks if Redis is accessible
func HealthCheck() error {
	if Client == nil || Client.client == nil {
		return fmt.Errorf("Redis client not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := Client.client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("Redis ping failed: %w", err)
	}

	return nil
}

// GetClient returns the underlying Redis client for advanced operations
func GetClient() *redis.Client {
	if Client != nil {
		return Client.client
	}
	return nil
}

// Set stores a value with an expiration time
func (r *RedisClient) Set(key string, value interface{}, expiration time.Duration) error {
	ctx, cancel := r.ctx()
	defer cancel()
	return r.client.Set(ctx, key, value, expiration).Err()
}

// Get retrieves a value by key
func (r *RedisClient) Get(key string) (string, error) {
	ctx, cancel := r.ctx()
	defer cancel()
	val, err := r.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", fmt.Errorf("%w: %s", ErrKeyNotFound, key)
	}
	return val, err
}

// Delete removes a key
func (r *RedisClient) Delete(keys ...string) error {
	ctx, cancel := r.ctx()
	defer cancel()
	return r.client.Del(ctx, keys...).Err()
}

// Exists checks if a key exists
func (r *RedisClient) Exists(keys ...string) (bool, error) {
	ctx, cancel := r.ctx()
	defer cancel()
	count, err := r.client.Exists(ctx, keys...).Result()
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// SetJSON stores a JSON-serialized value
func (r *RedisClient) SetJSON(key string, value interface{}, expiration time.Duration) error {
	jsonData, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}
	return r.Set(key, jsonData, expiration)
}

// GetJSON retrieves and deserializes a JSON value
func (r *RedisClient) GetJSON(key string, dest interface{}) error {
	val, err := r.Get(key)
	if err != nil {
		return err
	}

	if err := json.Unmarshal([]byte(val), dest); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %w", err)
	}

	return nil
}

// Increment increments a counter
func (r *RedisClient) Increment(key string) (int64, error) {
	ctx, cancel := r.ctx()
	defer cancel()
	return r.client.Incr(ctx, key).Result()
}

// IncrementBy increments a counter by a specific value
func (r *RedisClient) IncrementBy(key string, value int64) (int64, error) {
	ctx, cancel := r.ctx()
	defer cancel()
	return r.client.IncrBy(ctx, key, value).Result()
}

// Expire sets an expiration time on a key
func (r *RedisClient) Expire(key string, expiration time.Duration) error {
	ctx, cancel := r.ctx()
	defer cancel()
	return r.client.Expire(ctx, key, expiration).Err()
}

// TTL returns the time to live for a key
func (r *RedisClient) TTL(key string) (time.Duration, error) {
	ctx, cancel := r.ctx()
	defer cancel()
	return r.client.TTL(ctx, key).Result()
}

// FlushDB removes all keys from the current database (use with caution!)
func (r *RedisClient) FlushDB() error {
	ctx, cancel := r.ctx()
	defer cancel()
	return r.client.FlushDB(ctx).Err()
}

// Keys returns all keys matching a pattern
func (r *RedisClient) Keys(pattern string) ([]string, error) {
	ctx, cancel := r.ctx()
	defer cancel()
	return r.client.Keys(ctx, pattern).Result()
}

// SetNX sets a key only if it does not exist (atomic operation)
// Returns true if the key was set, false if it already existed
func (r *RedisClient) SetNX(key string, value interface{}, expiration time.Duration) (bool, error) {
	ctx, cancel := r.ctx()
	defer cancel()
	return r.client.SetNX(ctx, key, value, expiration).Result()
}

// incrWithExpireScript atomically increments a counter and sets its TTL on
// the first increment. Using a Lua script guarantees that INCR and EXPIRE are
// executed as a single atomic operation — if the process crashes between the
// two commands the key will not be left without a TTL and cause a permanent
// lock-out.
//
// KEYS[1] = counter key
// ARGV[1] = TTL in seconds (integer string)
var incrWithExpireScript = redis.NewScript(`
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`)

// IncrementWithExpiry atomically increments the counter at key and, on the
// first increment within a window, sets the TTL to expiration. Subsequent
// increments within the same window leave the TTL untouched so the window
// boundary does not drift.
func (r *RedisClient) IncrementWithExpiry(key string, expiration time.Duration) (int64, error) {
	ctx, cancel := r.ctx()
	defer cancel()
	ttlSecs := int64(expiration.Seconds())
	result, err := incrWithExpireScript.Run(ctx, r.client, []string{key}, ttlSecs).Int64()
	return result, err
}

// checkAndIncrWithLimitScript atomically checks whether adding amount to the
// current counter would exceed the limit. If not, it increments the counter
// and sets the TTL on the first write. Returns the new total on success, or
// -1 if the increment would exceed the limit (counter is not modified).
//
// KEYS[1] = counter key
// ARGV[1] = limit (integer)
// ARGV[2] = amount to add (integer)
// ARGV[3] = TTL in seconds
var checkAndIncrWithLimitScript = redis.NewScript(`
local current = tonumber(redis.call('GET', KEYS[1])) or 0
local limit = tonumber(ARGV[1])
local amount = tonumber(ARGV[2])
if current + amount > limit then
    return -1
end
local new = redis.call('INCRBY', KEYS[1], amount)
if new == amount then
    redis.call('EXPIRE', KEYS[1], ARGV[3])
end
return new
`)

// CheckAndIncrWithLimit atomically checks whether adding amountKobo to the
// daily counter at key would exceed limitKobo. If within the limit it records
// the amount and returns (newTotal, true, nil). If over the limit it leaves
// the counter untouched and returns (currentTotal, false, nil).
func (r *RedisClient) CheckAndIncrWithLimit(key string, limitKobo, amountKobo int64, ttl time.Duration) (int64, bool, error) {
	ctx, cancel := r.ctx()
	defer cancel()
	ttlSecs := int64(ttl.Seconds())
	result, err := checkAndIncrWithLimitScript.Run(ctx, r.client, []string{key}, limitKobo, amountKobo, ttlSecs).Int64()
	if err != nil {
		return 0, false, err
	}
	if result == -1 {
		return 0, false, nil
	}
	return result, true, nil
}

// DecrBy decrements the counter at key by value. Used to release a previously
// recorded withdrawal amount when the withdrawal is definitively rejected.
func (r *RedisClient) DecrBy(key string, value int64) error {
	ctx, cancel := r.ctx()
	defer cancel()
	return r.client.DecrBy(ctx, key, value).Err()
}
