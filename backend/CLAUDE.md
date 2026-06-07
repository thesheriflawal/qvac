# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Run
go run main.go          # or: air (hot reload)

# Build
go build -o bin/kynettic-backend .

# Format & lint
go fmt ./...
go vet ./...
golangci-lint run ./...  # if installed

# Tests (no test files yet; when added)
go test ./...
go test ./internal/service -run TestName

# Regenerate Swagger docs after changing handler annotations
~/go/bin/swag init -g main.go -o docs
```

## Architecture

Go backend for a P2P trading platform with edge-AI agents. Uses **Gin** framework, **GORM** (PostgreSQL), **Redis**, and **JWT** auth. AI inference runs client-side via `@qvac/sdk` (Next.js API routes) — the backend only stores market context and decisions.

### Layering (strict separation)

```
Handler (internal/handler/)     — HTTP boundary: request binding, validation, response formatting
    ↓
Service (internal/service/)     — Business logic, external API orchestration (all defined as interfaces)
    ↓
Repository (internal/repository/) — GORM queries, data access (all defined as interfaces)
    ↓
Models (internal/models/)       — GORM structs, hooks (BeforeCreate/BeforeUpdate), UUID PKs, soft deletes
```

### Composition Root

`main.go` wires everything: config → logger → DB → Redis → clients → repos → services → handlers → router. All dependencies are injected via constructors (`NewXxxService(repo, cfg)`), no globals for business logic.

### Key Directories

- `internal/clients/` — External API clients (CoinGecko, Cloudinary, Resend email, Telegram)
- `internal/middleware/` — Auth (JWT + Redis sessions), CORS, rate limiting, idempotency, request ID, recovery
- `internal/router/router.go` — All route definitions, middleware assignment, API versioning (`/api/v1`)
- `internal/utils/` — JWT, password hashing (bcrypt), AES encryption, OTP, response helpers, validation
- `internal/oauth/` — Google and Apple OAuth token verification
- `pkg/logger/` — Zap structured logging setup
- `docs/` — Auto-generated Swagger docs (do not edit by hand)

## Key Patterns

**Base model**: All models embed `models.BaseModel` (UUID PK via `BeforeCreate` hook, `CreatedAt`/`UpdatedAt`, `gorm.DeletedAt` for soft deletes).

**Auth flow**: JWT access token (24h) + refresh token (7d). Sessions tracked in Redis (`session:<user_id>:<device_type>`) with 30min inactivity timeout. User extracted in handlers via `middleware.GetUserFromContext(c)`.

**Response format**: All responses use `utils.SuccessResponse(c, status, message, data)` or `utils.ErrorResponse(c, status, message, err)`. Paginated responses include a `pagination` object.

**Idempotency**: Critical mutations (P2P trades, transfers, withdrawals) require `Idempotency-Key` header, tracked in Redis.

**Sensitive data**: KYC identity numbers (BVN/NIN) are AES-encrypted via `utils.Encrypt`/`utils.Decrypt` using `KYC_ENCRYPTION_KEY`.

**Error propagation**: Repositories return raw GORM errors → services translate to business errors → handlers map to HTTP status codes.

**Pagination**: Use `database.Paginate(page, pageSize)` scope in repository queries.

## Adding a New Feature

1. Model in `internal/models/` (embed `BaseModel`)
2. Add model to `AutoMigrate()` list in `internal/database/database.go`
3. Repository interface + impl in `internal/repository/`
4. Service interface + impl in `internal/service/`
5. Handler with Swagger annotations in `internal/handler/`
6. Register routes in `internal/router/router.go`
7. Wire dependencies in `main.go`
8. Run `~/go/bin/swag init -g main.go -o docs`

## Configuration

Loaded via Viper from `.env` file + environment variables (`internal/config/config.go`).

**Required to start**: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `KYC_ENCRYPTION_KEY`, `KYC_BLIND_INDEX_KEY`, `PIN_PEPPER`, `RESEND_API_KEY`

**Notable defaults**: `APP_PORT=8080`, `DB_SSLMODE=require`, `DB_AUTO_MIGRATE=true`, `REDIS_ENABLED=true`, `RATE_LIMIT_REQUESTS=100/1m`

**Removed (QVAC hackathon)**: Blockradar, Nomba, Dojah, Quidax — all fintech/exchange integrations are removed. Crypto deposits/withdrawals and fiat operations return 503. KYC tiers store data locally without external verification.

See `.env.example` for the full list.

## Git Conventions

Commit messages use semantic prefixes: `feat:`, `fix:`, `refactor:`, etc. Main development branch is `dev`.
