# Kynettic Backend API

A production-ready, modular backend API built with Go, Gin framework, and PostgreSQL (Neon).

## Features

- ✅ **Clean Architecture** - Separation of concerns with handlers, services, and repositories
- ✅ **JWT Authentication** - Secure token-based authentication with refresh tokens
- ✅ **Role-Based Access Control** - Admin and user roles with middleware protection
- ✅ **PostgreSQL with GORM** - Robust ORM with migrations and connection pooling
- ✅ **Redis Cache** - High-performance caching and session management
- ✅ **Structured Logging** - Production-ready logging with Zap
- ✅ **Input Validation** - Request validation with custom error formatting
- ✅ **Rate Limiting** - Built-in rate limiting per IP
- ✅ **CORS Support** - Configurable CORS middleware
- ✅ **Graceful Shutdown** - Proper cleanup on server shutdown
- ✅ **Docker Support** - Multi-stage Dockerfile and Docker Compose setup
- ✅ **API Versioning** - `/api/v1` prefix for future compatibility
- ✅ **Swagger/OpenAPI** - Interactive API documentation with Swagger UI

## Project Structure

```
backend/
├── main.go                        # Application entry point
├── internal/
│   ├── cache/                      # Redis cache layer
│   ├── config/                     # Configuration management
│   ├── database/                   # Database connection & migrations
│   ├── middleware/                 # HTTP middleware (auth, cors, logging, etc.)
│   ├── models/                     # Database models
│   ├── repository/                 # Data access layer
│   ├── service/                    # Business logic layer
│   ├── handler/                    # HTTP handlers
│   ├── router/                     # Route definitions
│   └── utils/                      # Utility functions
├── pkg/
│   └── logger/                     # Logger setup
├── .env.example                    # Environment variables template
├── Dockerfile                      # Docker configuration
├── docker-compose.yml              # Docker Compose setup
└── README.md                       # This file
```

## Prerequisites

- Go 1.21 or higher
- PostgreSQL 15+ (or Neon account)
- Redis 7+ (optional for local development, included in Docker Compose)
- Docker & Docker Compose (optional, for local development)

## Getting Started

### 1. Clone and Setup

```bash
cd backend
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file with your configuration:

```env
# Database (Neon PostgreSQL)
DB_HOST=your-neon-host.neon.tech
DB_PORT=5432
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=kynettic
DB_SSLMODE=require

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT Secrets (change these!)
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
```

### 3. Install Dependencies

```bash
go mod download
go mod tidy
```

### 4. Run the Application

**Option A: Direct Run**

```bash
go run main.go
```

**Option B: Build and Run**

```bash
go build -o bin/server main.go
./bin/server
```

**Option C: Docker Compose (with local PostgreSQL + Redis)**

```bash
docker-compose up -d
```

The server will start on `http://localhost:8080`

## API Documentation

Interactive API documentation is available via Swagger UI:

**Access Swagger UI**: `http://localhost:8080/swagger/index.html`

The Swagger documentation provides:

- Complete API endpoint reference
- Request/response schemas
- Interactive API testing
- Authentication support (Bearer token)

### Regenerate Swagger Docs

After modifying API endpoints or adding new handlers, regenerate the documentation:

```bash
~/go/bin/swag init -g main.go -o docs
```

Or install swag globally:

```bash
go install github.com/swaggo/swag/cmd/swag@latest
swag init -g main.go -o docs
```

## API Endpoints

### Documentation

- `GET /swagger/index.html` - Swagger UI (interactive API documentation)

### Health Check

- `GET /health` - Check service health

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token

### Users (Protected)

- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update current user profile
- `POST /api/v1/users/me/change-password` - Change password

### Admin Only

- `GET /api/v1/users` - List all users (paginated)
- `GET /api/v1/users/:id` - Get user by ID
- `DELETE /api/v1/users/:id` - Delete user

## Example API Calls

### Register

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'
```

### Login

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Get Profile (Protected)

```bash
curl -X GET http://localhost:8080/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Adding New Features

The boilerplate is designed to be easily extensible. Here's how to add a new feature:

### 1. Create Model

```go
// internal/models/product.go
type Product struct {
    BaseModel
    Name        string  `gorm:"not null" json:"name"`
    Description string  `json:"description"`
    Price       float64 `gorm:"not null" json:"price"`
}
```

### 2. Create Repository

```go
// internal/repository/product_repository.go
type ProductRepository interface {
    Create(product *models.Product) error
    FindByID(id uint) (*models.Product, error)
    // ... other methods
}
```

### 3. Create Service

```go
// internal/service/product_service.go
type ProductService interface {
    CreateProduct(name, description string, price float64) (*models.Product, error)
    // ... other methods
}
```

### 4. Create Handler

```go
// internal/handler/product_handler.go
type ProductHandler struct {
    productService service.ProductService
}
```

### 5. Register Routes

```go
// internal/router/router.go
products := v1.Group("/products")
{
    products.GET("", productHandler.List)
    products.POST("", productHandler.Create)
    // ... other routes
}
```

### 6. Update Database Migration

```go
// internal/database/database.go
err := DB.AutoMigrate(
    &models.User{},
    &models.Product{}, // Add new model
)
```

## Environment Variables

| Variable                 | Description                          | Default     |
| ------------------------ | ------------------------------------ | ----------- |
| `APP_ENV`                | Environment (development/production) | development |
| `APP_PORT`               | Server port                          | 8080        |
| `DB_HOST`                | Database host                        | -           |
| `DB_PORT`                | Database port                        | 5432        |
| `DB_USER`                | Database user                        | -           |
| `DB_PASSWORD`            | Database password                    | -           |
| `DB_NAME`                | Database name                        | -           |
| `DB_SSLMODE`             | SSL mode (require/disable)           | require     |
| `REDIS_HOST`             | Redis host                           | localhost   |
| `REDIS_PORT`             | Redis port                           | 6379        |
| `REDIS_PASSWORD`         | Redis password (optional)            | -           |
| `REDIS_DB`               | Redis database number                | 0           |
| `JWT_SECRET`             | JWT secret key                       | -           |
| `JWT_EXPIRATION`         | Access token expiration              | 24h         |
| `JWT_REFRESH_SECRET`     | Refresh token secret                 | -           |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiration             | 168h        |
| `CORS_ALLOWED_ORIGINS`   | Allowed CORS origins                 | -           |
| `RATE_LIMIT_REQUESTS`    | Max requests per duration            | 100         |
| `RATE_LIMIT_DURATION`    | Rate limit time window               | 1m          |
| `LOG_LEVEL`              | Log level (debug/info/warn/error)    | info        |
| `LOG_FORMAT`             | Log format (console/json)            | json        |

## Production Deployment

### Using Neon PostgreSQL

1. Create a Neon project at [neon.tech](https://neon.tech)
2. Copy the connection string
3. Update `.env` with Neon credentials
4. Set `DB_SSLMODE=require`

### Build for Production

```bash
CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server cmd/server/main.go
```

### Docker Deployment

```bash
docker build -t kynettic-backend .
docker run -p 8080:8080 --env-file .env kynettic-backend
```

## Security Best Practices

- ✅ Change default JWT secrets in production
- ✅ Use strong passwords (min 6 characters enforced)
- ✅ Enable SSL/TLS for database connections
- ✅ Set appropriate CORS origins
- ✅ Use environment variables for sensitive data
- ✅ Enable rate limiting
- ✅ Keep dependencies updated

## Development

### Run Tests

```bash
go test ./...
```

### Format Code

```bash
go fmt ./...
```

### Lint Code

```bash
golangci-lint run
```

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
