package ratelimit

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"
)

// Limiter is a channel-based token-bucket rate limiter.
type Limiter struct {
	tokens chan struct{}
	quit   chan struct{}
}

// NewLimiter creates a Limiter that allows rps requests per second with the
// given burst capacity. The bucket starts full so the first burst requests
// are not delayed.
func NewLimiter(rps float64, burst int) *Limiter {
	l := &Limiter{
		tokens: make(chan struct{}, burst),
		quit:   make(chan struct{}),
	}
	for i := 0; i < burst; i++ {
		l.tokens <- struct{}{}
	}
	go l.refill(rps)
	return l
}

func (l *Limiter) refill(rps float64) {
	interval := time.Duration(float64(time.Second) / rps)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			select {
			case l.tokens <- struct{}{}:
			default: // bucket full, discard token
			}
		case <-l.quit:
			return
		}
	}
}

// Acquire blocks until a token is available or ctx is cancelled.
func (l *Limiter) Acquire(ctx context.Context) error {
	select {
	case <-l.tokens:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Stop shuts down the background refill goroutine.
func (l *Limiter) Stop() {
	close(l.quit)
}

// Transport is an http.RoundTripper that rate-limits outgoing requests and
// retries on HTTP 429 (Too Many Requests) using exponential backoff.
type Transport struct {
	Base       http.RoundTripper // defaults to http.DefaultTransport when nil
	Limiter    *Limiter
	MaxRetries int // number of retries on 429; defaults to 3
}

// NewTransport returns a Transport wrapping http.DefaultTransport with the given limiter.
func NewTransport(limiter *Limiter) *Transport {
	return &Transport{
		Base:       http.DefaultTransport,
		Limiter:    limiter,
		MaxRetries: 3,
	}
}

// RoundTrip implements http.RoundTripper.
func (t *Transport) RoundTrip(req *http.Request) (*http.Response, error) {
	base := t.Base
	if base == nil {
		base = http.DefaultTransport
	}

	if err := t.Limiter.Acquire(req.Context()); err != nil {
		return nil, err
	}

	resp, err := base.RoundTrip(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusTooManyRequests {
		return resp, nil
	}
	// Body consumed and cannot be replayed — return the 429 as-is.
	if req.Body != nil && req.GetBody == nil {
		return resp, nil
	}

	for attempt := 0; attempt < t.MaxRetries && resp.StatusCode == http.StatusTooManyRequests; attempt++ {
		resp.Body.Close()

		select {
		case <-time.After(retryDelay(resp, attempt)):
		case <-req.Context().Done():
			return nil, req.Context().Err()
		}

		if req.GetBody != nil {
			body, err := req.GetBody()
			if err != nil {
				return nil, fmt.Errorf("ratelimit: rebuild request body for retry: %w", err)
			}
			req.Body = body
		}

		if err := t.Limiter.Acquire(req.Context()); err != nil {
			return nil, err
		}

		resp, err = base.RoundTrip(req)
		if err != nil {
			return nil, err
		}
	}

	return resp, nil
}

// retryDelay returns how long to wait before the next attempt.
// It honours the Retry-After response header when present, otherwise falls
// back to exponential backoff starting at 500 ms.
func retryDelay(resp *http.Response, attempt int) time.Duration {
	if ra := resp.Header.Get("Retry-After"); ra != "" {
		if secs, err := strconv.Atoi(ra); err == nil && secs > 0 {
			return time.Duration(secs) * time.Second
		}
	}
	return time.Duration(math.Pow(2, float64(attempt))) * 500 * time.Millisecond
}
