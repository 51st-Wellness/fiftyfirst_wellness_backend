# Authentication Module Documentation

## Overview

The Authentication Module is responsible for handling user authentication, authorization, and session management in the FiftyFirst Wellness Backend. It provides secure JWT-based authentication with cookie-based token storage, password reset functionality, and role-based access control.

## Module Structure

```
src/modules/auth/
├── auth.controller.ts          # Authentication endpoints
├── auth.service.ts            # Core authentication logic
├── auth.module.ts             # Module configuration
└── strategies/                # Passport.js strategies
    ├── jwt.strategy.ts        # JWT token validation
    └── local.strategy.ts      # Local email/password authentication
```

## Core Components

### 1. AuthService (`auth.service.ts`)

The main service that handles all authentication-related operations.

#### Key Methods

##### `validateUser(email: string, password: string)`

- **Purpose**: Validates user credentials during login
- **Returns**: User object without password
- **Throws**: `UnauthorizedException` for invalid credentials or deactivated accounts

```typescript
async validateUser(email: string, password: string): Promise<Omit<User, 'password'>>
```

##### `register(createUserDto: CreateUserDto)`

- **Purpose**: Registers a new user account
- **Features**:
  - Password hashing with bcrypt
  - Welcome email notification
  - Duplicate email validation
- **Returns**: Created user without password

```typescript
async register(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>>
```

##### `issueAccessTokenWithCookie(user: User, res: Response)`

- **Purpose**: Generates JWT token and sets secure HTTP-only cookie
- **Features**:
  - RS256 algorithm for token signing
  - 1-hour expiration
  - Secure cookie configuration
- **Returns**: JWT access token string

```typescript
async issueAccessTokenWithCookie(user: Omit<User, 'password'>, res: Response): Promise<string>
```

##### `generatePasswordResetOTP(email: string)`

- **Purpose**: Initiates password reset process
- **Features**:
  - 6-digit OTP generation
  - 15-minute expiration
  - Email notification via Brevo
- **Throws**: `NotFoundException` for non-existent users

```typescript
async generatePasswordResetOTP(email: string): Promise<void>
```

##### `resetPasswordWithOTP(email: string, otp: string, newPassword: string)`

- **Purpose**: Resets password using OTP verification
- **Features**:
  - OTP validation
  - Password hashing
  - OTP cleanup after successful reset
- **Throws**: `BadRequestException` for invalid/expired OTP

```typescript
async resetPasswordWithOTP(email: string, otp: string, newPassword: string): Promise<void>
```

### 2. AuthController (`auth.controller.ts`)

Handles HTTP requests for authentication operations.

#### Endpoints

##### `POST /api/auth/signup`

- **Purpose**: User registration
- **Request Body**: `CreateUserDto`
- **Features**:
  - Role-based registration (ADMIN requires root API key)
  - Automatic login after registration
  - JWT cookie setting
- **Response**: User data and access token

```typescript
@Post('signup')
async register(
  @Body() body: CreateUserDto,
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response
)
```

##### `POST /api/auth/login`

- **Purpose**: User login
- **Request Body**: `LoginDto` (email, password)
- **Features**:
  - Local strategy authentication
  - JWT token generation
  - Secure cookie setting
- **Response**: User data and access token

```typescript
@UseGuards(AuthGuard('local'))
@Post('login')
async login(@Req() req: Request, @Res({ passthrough: true }) res: Response)
```

##### `POST /api/auth/logout`

- **Purpose**: User logout
- **Features**: Clears JWT cookie
- **Response**: Success message

```typescript
@Post('logout')
async logout(@Res({ passthrough: true }) res: Response)
```

##### `POST /api/auth/forget-password`

- **Purpose**: Request password reset
- **Request Body**: `ForgetPasswordDto` (email)
- **Features**: OTP generation and email sending
- **Response**: Success message

```typescript
@Post('forget-password')
async forgetPassword(@Body() forgetPasswordDto: ForgetPasswordDto)
```

##### `POST /api/auth/reset-password`

- **Purpose**: Reset password with OTP
- **Request Body**: `ResetPasswordDto` (email, otp, newPassword)
- **Features**: OTP verification and password update
- **Response**: Success message

```typescript
@Post('reset-password')
async resetPassword(@Body() resetPasswordDto: ResetPasswordDto)
```

### 3. Authentication Strategies

#### JWT Strategy (`jwt.strategy.ts`)

Handles JWT token validation and user extraction.

**Features**:

- Dual token extraction (cookie + Bearer header)
- RS256 algorithm verification
- Automatic payload validation
- User object reconstruction

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: config.get(ENV.JWT_PUBLIC_KEY),
    });
  }
}
```

#### Local Strategy (`local.strategy.ts`)

Handles email/password authentication.

**Features**:

- Email-based username field
- Password validation via AuthService
- Stateless authentication

```typescript
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      session: false,
    });
  }
}
```

## Security Features

### 1. JWT Token Security

- **Algorithm**: RS256 (asymmetric encryption)
- **Expiration**: 1 hour
- **Storage**: HTTP-only cookies
- **Extraction**: Cookie + Bearer header support

### 2. Password Security

- **Hashing**: bcrypt with 12 salt rounds
- **Validation**: Secure comparison
- **Reset**: OTP-based with 15-minute expiration

### 3. Account Security

- **Status Validation**: Active account requirement
- **Role-Based Access**: Admin/User role enforcement
- **Root API Key**: Required for admin registration

### 4. Cookie Security

```typescript
{
  httpOnly: true,      // Prevents XSS attacks
  sameSite: 'lax',     // CSRF protection
  secure: false,       // Set to true in production
  maxAge: 3600000,     // 1 hour
  path: '/'
}
```

## Data Transfer Objects (DTOs)

### CreateUserDto

```typescript
{
  email: string;           // Required, valid email
  password: string;        // Required, min 6 characters
  firstName: string;       // Required
  lastName: string;        // Required
  phone: string;          // Required
  city?: string;          // Optional
  address?: string;       // Optional
  bio?: string;           // Optional
  role?: UserRole;        // Optional, defaults to USER
}
```

### LoginDto

```typescript
{
  email: string; // Required, valid email
  password: string; // Required
}
```

### ForgetPasswordDto

```typescript
{
  email: string; // Required, valid email
}
```

### ResetPasswordDto

```typescript
{
  email: string; // Required, valid email
  otp: string; // Required, 6-digit OTP
  newPassword: string; // Required, min 6 characters
}
```

## Authentication Flow

### 1. User Registration Flow

```
1. Client sends registration data
2. Validate input data
3. Check for existing user
4. Hash password with bcrypt
5. Create user in database
6. Send welcome email
7. Generate JWT token
8. Set secure cookie
9. Return user data and token
```

### 2. User Login Flow

```
1. Client sends login credentials
2. Local strategy validates credentials
3. Check account status (active/inactive)
4. Verify password with bcrypt
5. Generate JWT token
6. Set secure cookie
7. Return user data and token
```

### 3. Password Reset Flow

```
1. User requests password reset
2. Validate email existence
3. Generate 6-digit OTP
4. Store OTP with 15-minute expiration
5. Send email with OTP
6. User submits OTP and new password
7. Verify OTP validity
8. Hash new password
9. Update user password
10. Clear OTP from database
```

## Error Handling

### Common Exceptions

- `UnauthorizedException`: Invalid credentials or deactivated account
- `ConflictException`: Duplicate email during registration
- `NotFoundException`: User not found for password reset
- `BadRequestException`: Invalid or expired OTP

### Error Response Format

```typescript
{
  success: false,
  message: "Error description",
  data: null
}
```

## Integration Points

### 1. User Module

- User creation and management
- Password operations
- Profile updates

### 2. Notification Module

- Welcome email sending
- Password reset email delivery

### 3. Common Module

- Role-based guards
- Custom decorators
- Response formatting

## Testing Considerations

### Unit Tests

- AuthService method testing
- Strategy validation testing
- DTO validation testing

### Integration Tests

- End-to-end authentication flow
- Cookie handling
- JWT token validation

### Security Tests

- Password hashing verification
- JWT token security
- CSRF protection
- XSS prevention

## Environment Variables

### Required Variables

```env
JWT_PRIVATE_KEY="your_jwt_private_key"
JWT_PUBLIC_KEY="your_jwt_public_key"
ROOT_API_KEY="your_root_api_key"
BREVO_API_KEY="your_brevo_api_key"
BREVO_SENDER_EMAIL="noreply@yourdomain.com"
```
