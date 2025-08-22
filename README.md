# FiftyFirst Wellness Backend

A robust NestJS backend application for a wellness platform that provides user management, authentication, content delivery (webinars, podcasts), e-commerce functionality, and AI-powered conversations.

## 🚀 Features

- **User Management**: Complete user registration, authentication, and profile management
- **Role-Based Access Control**: Admin and User roles with secure authorization
- **Content Management**: Webinars and podcasts with Mux video integration
- **E-commerce**: Product catalog and order management
- **AI Conversations**: Chat history and AI interaction tracking
- **Email Notifications**: Password reset and welcome emails via Brevo
- **Security**: JWT authentication, password hashing, and comprehensive security measures
- **Logging**: Structured logging with Winston
- **Database**: SQLite with Prisma ORM (supports Turso for production)

## 🛠️ Technology Stack

### Core Framework

- **NestJS** - Progressive Node.js framework for building scalable server-side applications
- **TypeScript** - Type-safe JavaScript development
- **Prisma** - Modern database toolkit and ORM

### Database

- **SQLite** - Lightweight, serverless database (development)
- **Turso** - Distributed SQLite database (production ready)
- **Prisma Client** - Type-safe database client

### Authentication & Security

- **Passport.js** - Authentication middleware
- **JWT** - JSON Web Tokens for stateless authentication
- **bcrypt** - Password hashing
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing

### Email & Notifications

- **Brevo** - Email service provider
- **EJS** - Email template engine

### Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **pnpm** - Package manager

## 📁 Project Structure

```
src/
├── app.module.ts              # Main application module
├── main.ts                    # Application bootstrap
├── config/                    # Configuration management
│   ├── app.config.ts         # Application configuration
│   ├── database.config.ts    # Database configuration
│   └── env.enum.ts          # Environment variables enum
├── modules/                   # Feature modules
│   ├── auth/                 # Authentication module
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── strategies/       # Passport strategies
│   ├── user/                 # User management module
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── user.repository.ts
│   │   └── dto/             # Data transfer objects
│   └── notification/         # Email notifications
│       └── email/           # Email service
├── common/                   # Shared utilities
│   ├── decorators/          # Custom decorators
│   └── gaurds/             # Authentication guards
├── lib/                     # Library modules
│   └── logging/            # Structured logging
├── prisma/                  # Database schema and client
└── util/                    # Utility functions
```

## 🗄️ Database Schema

The application uses a comprehensive database schema with the following main entities:

- **User**: User accounts with role-based access control
- **Product**: E-commerce products (physical and digital)
- **Webinar**: Video-based workshops with Mux integration
- **Podcast**: Audio/video podcast episodes
- **Order**: E-commerce orders and order items
- **AIConversation**: AI chat history
- **PasswordResetOTP**: Secure password reset functionality

## 🔧 Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- pnpm (v10.14.0 or higher)
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd fiftyfirst_wellness_backend
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="file:./dev.db"
TURSO_AUTH_TOKEN="your_turso_auth_token"

# JWT Authentication
JWT_PRIVATE_KEY="your_jwt_private_key"
JWT_PUBLIC_KEY="your_jwt_public_key"

# Application
NODE_ENV="development"
PORT="3000"
DEVELOPMENT_URL="http://localhost:3000"
PRODUCTION_URL="https://your-production-url.com"

# Security
ROOT_API_KEY="your_root_api_key"
APP_NAME="FiftyFirst Wellness"

# Logging
LOG_LEVEL="info"

# Email (Brevo)
BREVO_API_KEY="your_brevo_api_key"
BREVO_SENDER_EMAIL="noreply@yourdomain.com"
COMPANY_NAME="FiftyFirst Wellness"
```

### 4. Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# (Optional) Reset database
pnpm db:reset

# (Optional) Open Prisma Studio
pnpm db:studio


# Since prisma uses a driver to communicate with libsql, run command, ensure turso cli is installed
turso db shell fifty-firstwellness < './prisma/migrations/[migration_folder]/migration.sql'
```

### 5. Start Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000/api`

## 🔒 Security Features

- **JWT Authentication**: Stateless authentication with secure cookies
- **Password Hashing**: bcrypt for secure password storage
- **Role-Based Access Control**: Granular permission system
- **Security Headers**: Helmet for comprehensive security
- **CORS Protection**: Configurable cross-origin policies
- **Input Validation**: Class-validator for request validation
- **Rate Limiting**: Built-in protection against abuse

## 📊 Logging

The application uses structured logging with Winston:

- **Correlation IDs**: Request tracking across services
- **Sensitive Data Filtering**: Automatic PII protection
- **Multiple Log Levels**: Debug, info, warn, error
- **Structured Format**: JSON logging for production

## 🚀 Production Deployment

### Railway Deployment

The project includes `railway.json` for easy Railway deployment.

### Environment Variables

Ensure all production environment variables are set:

- Use Turso database URL for production
- Set proper JWT keys
- Configure Brevo email settings
- Set appropriate CORS origins

### Database Migration

```bash
# Apply latest migrations
pnpm db:apply-latest
```

## 📝 API Documentation

### Base URL

- Development: `http://localhost:3000/api`
- Production: `https://your-domain.com/api`

### 📚 Official API Documentation

Access the full API documentation here:  
[https://rxqc451psr.apidog.io](https://rxqc451psr.apidog.io)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is private and unlicensed.

## 👨‍💻 Author

**prospercoded** - Backend Developer

---

For more detailed information about specific modules or features, please refer to the inline documentation and comments in the source code.
