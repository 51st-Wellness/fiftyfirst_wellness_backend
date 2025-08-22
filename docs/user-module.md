# User Module Documentation

## Overview

The User Module is responsible for managing user accounts, profiles, and administrative operations in the FiftyFirst Wellness Backend. It provides comprehensive user management functionality including CRUD operations, profile updates, role management, and administrative features with role-based access control.

## Module Structure

```
src/modules/user/
├── user.controller.ts          # User management endpoints
├── user.service.ts            # Core user business logic
├── user.repository.ts         # Database operations layer
├── user.module.ts             # Module configuration
└── dto/                       # Data transfer objects
    ├── create-user.dto.ts     # User creation validation
    ├── update-user.dto.ts     # User update validation
    ├── update-profile.dto.ts  # Profile update validation
    ├── login.dto.ts           # Login validation
    ├── user-query.dto.ts      # Query parameters validation
    ├── change-role.dto.ts     # Role change validation
    ├── toggle-user-status.dto.ts # Status toggle validation
    ├── forget-password.dto.ts # Password reset request
    └── reset-password.dto.ts  # Password reset validation
```

## Core Components

### 1. UserService (`user.service.ts`)

The main service that handles all user-related business logic and operations.

#### Key Methods

##### `create(createUserDto: CreateUserDto)`

- **Purpose**: Creates a new user account
- **Features**:
  - Password hashing with bcrypt (12 salt rounds)
  - Duplicate email validation
  - Sensitive data filtering
- **Returns**: User object without password
- **Throws**: `ConflictException` for duplicate emails

```typescript
async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>>
```

##### `findOne(id: string)`

- **Purpose**: Retrieves a single user by ID
- **Features**: Sensitive data filtering
- **Returns**: User object without password or null

```typescript
async findOne(id: string): Promise<Omit<User, 'password'> | null>
```

##### `findByEmail(email: string)`

- **Purpose**: Finds user by email (for authentication)
- **Features**: Returns full user object including password
- **Returns**: Complete User object or null

```typescript
async findByEmail(email: string): Promise<User | null>
```

##### `findAll(skip?: number, take?: number)`

- **Purpose**: Retrieves paginated list of users
- **Features**:
  - Pagination support
  - Sensitive data filtering
- **Returns**: Array of users without passwords

```typescript
async findAll(skip?: number, take?: number): Promise<Omit<User, 'password'>[]>
```

##### `update(id: string, updateUserDto: UpdateUserDto)`

- **Purpose**: Updates user information
- **Features**:
  - Optional password hashing
  - Sensitive data filtering
  - Partial updates support
- **Returns**: Updated user without password

```typescript
async update(id: string, updateUserDto: UpdateUserDto): Promise<Omit<User, 'password'>>
```

##### `verifyPassword(user: User, password: string)`

- **Purpose**: Verifies user password during authentication
- **Features**: Secure bcrypt comparison
- **Returns**: Boolean indicating password validity

```typescript
async verifyPassword(user: User, password: string): Promise<boolean>
```

##### `updateProfile(userId: string, updateProfileDto: UpdateProfileDto)`

- **Purpose**: Updates user profile information
- **Features**: Profile-specific field updates
- **Returns**: Updated user without password

```typescript
async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<Omit<User, 'password'>>
```

##### `findManyWithFilters(query: UserQueryDto)`

- **Purpose**: Advanced user search with filters (Admin only)
- **Features**:
  - Pagination
  - Search by name/email
  - Role filtering
  - Status filtering
- **Returns**: Paginated results with total count

```typescript
async findManyWithFilters(query: UserQueryDto): Promise<{ users: Omit<User, 'password'>[]; total: number }>
```

##### `toggleUserStatus(userId: string, isActive: boolean)`

- **Purpose**: Activates/deactivates user accounts (Admin only)
- **Features**: Account status management
- **Returns**: Updated user without password

```typescript
async toggleUserStatus(userId: string, isActive: boolean): Promise<Omit<User, 'password'>>
```

##### `changeUserRole(userId: string, role: UserRole)`

- **Purpose**: Changes user role (Admin only)
- **Features**: Role-based access control
- **Returns**: Updated user without password

```typescript
async changeUserRole(userId: string, role: UserRole): Promise<Omit<User, 'password'>>
```

### 2. UserRepository (`user.repository.ts`)

Handles all database operations and queries for user data.

#### Key Methods

##### `create(data: CreateUserInput)`

- **Purpose**: Creates user in database
- **Features**: Prisma client operations
- **Returns**: Created User object

##### `findById(id: string)`

- **Purpose**: Finds user by ID
- **Returns**: User object or null

##### `findByEmail(email: string)`

- **Purpose**: Finds user by email
- **Returns**: User object or null

##### `findAll(skip?: number, take?: number)`

- **Purpose**: Retrieves paginated users
- **Returns**: Array of User objects

##### `update(id: string, data: UpdateUserInput)`

- **Purpose**: Updates user data
- **Returns**: Updated User object

##### `delete(id: string)`

- **Purpose**: Deletes user account
- **Returns**: Deleted User object

##### `findManyWithFilters(page: number, pageSize: number, filters: UserFilters)`

- **Purpose**: Advanced user search with filters
- **Returns**: Users array and total count

### 3. UserController (`user.controller.ts`)

Handles HTTP requests for user management operations.

#### Endpoints

##### `GET /api/user/me`

- **Purpose**: Get current user profile
- **Authentication**: Required (JWT)
- **Features**: Returns authenticated user's profile
- **Response**: User profile data

```typescript
@UseGuards(RolesGuard)
@Get('me')
async getProfile(@Req() req: Request)
```

##### `PUT /api/user/me`

- **Purpose**: Update current user profile
- **Authentication**: Required (JWT)
- **Request Body**: `UpdateProfileDto`
- **Features**: Profile-specific updates
- **Response**: Updated user profile

```typescript
@UseGuards(RolesGuard)
@Put('me')
async updateProfile(
  @Body() updateProfileDto: UpdateProfileDto,
  @Req() req: Request
)
```

##### `GET /api/user`

- **Purpose**: Get all users (Admin only)
- **Authentication**: Required (JWT + Admin role)
- **Query Parameters**: `UserQueryDto`
- **Features**:
  - Pagination
  - Search functionality
  - Role filtering
  - Status filtering
- **Response**: Paginated user list

```typescript
@UseGuards(RolesGuard)
@StrictRoles(UserRole.ADMIN)
@Get()
async getAllUsers(@Query() query: UserQueryDto)
```

##### `GET /api/user/:id`

- **Purpose**: Get specific user by ID (Admin only)
- **Authentication**: Required (JWT + Admin role)
- **Features**: Individual user retrieval
- **Response**: User data

```typescript
@UseGuards(RolesGuard)
@StrictRoles(UserRole.ADMIN)
@Get(':id')
async findUserById(@Param('id') id: string)
```

##### `PUT /api/user/:id/status`

- **Purpose**: Toggle user active status (Admin only)
- **Authentication**: Required (JWT + Admin role)
- **Request Body**: `ToggleUserStatusDto`
- **Features**: Account activation/deactivation
- **Response**: Updated user data

```typescript
@UseGuards(RolesGuard)
@StrictRoles(UserRole.ADMIN)
@Put(':id/status')
async toggleUserStatus(
  @Param('id') id: string,
  @Body() toggleUserStatusDto: ToggleUserStatusDto
)
```

##### `PUT /api/user/:id/role`

- **Purpose**: Change user role (Admin only)
- **Authentication**: Required (JWT + Admin role + Root API key)
- **Request Body**: `ChangeRoleDto`
- **Features**: Role-based access control
- **Response**: Updated user data

```typescript
@UseGuards(RolesGuard)
@StrictRoles(UserRole.ADMIN)
@Put(':id/role')
async changeUserRole(
  @Param('id') id: string,
  @Body() changeRoleDto: ChangeRoleDto,
  @Req() req: Request
)
```

## Data Transfer Objects (DTOs)

### CreateUserDto

```typescript
{
  email: string;           // Required, valid email format
  password: string;        // Required, minimum 6 characters
  firstName: string;       // Required
  lastName: string;        // Required
  phone: string;          // Required
  city?: string;          // Optional
  address?: string;       // Optional
  bio?: string;           // Optional
  role?: UserRole;        // Optional, defaults to USER
}
```

### UpdateUserDto

```typescript
{
  email?: string;          // Optional, valid email format
  password?: string;       // Optional, minimum 6 characters
  firstName?: string;      // Optional
  lastName?: string;       // Optional
  phone?: string;         // Optional
  city?: string;          // Optional
  address?: string;       // Optional
  bio?: string;           // Optional
  role?: UserRole;        // Optional
}
```

### UpdateProfileDto

```typescript
{
  firstName?: string;      // Optional
  lastName?: string;       // Optional
  phone?: string;         // Optional
  city?: string;          // Optional
  address?: string;       // Optional
  bio?: string;           // Optional
  profilePicture?: string; // Optional
}
```

### UserQueryDto

```typescript
{
  page?: number;          // Optional, defaults to 1
  pageSize?: number;      // Optional, defaults to 10
  search?: string;        // Optional, search in name/email
  role?: UserRole;        // Optional, filter by role
  isActive?: boolean;     // Optional, filter by status
}
```

### ChangeRoleDto

```typescript
{
  role: UserRole; // Required, new role
}
```

### ToggleUserStatusDto

```typescript
{
  isActive: boolean; // Required, new status
}
```

## User Roles and Permissions

### UserRole Enum

```typescript
enum UserRole {
  USER = 'USER', // Standard user
  ADMIN = 'ADMIN', // Administrative user
}
```

### Role-Based Access Control

#### USER Role Permissions

- View own profile
- Update own profile
- Access content and e-commerce features

#### ADMIN Role Permissions

- All USER permissions
- View all users
- View individual user details
- Toggle user status (activate/deactivate)
- Change user roles (with root API key)

## Security Features

### 1. Password Security

- **Hashing**: bcrypt with 12 salt rounds
- **Validation**: Secure comparison for authentication
- **Reset**: OTP-based password reset system

### 2. Data Protection

- **Sensitive Data Filtering**: Automatic password removal from responses
- **Input Validation**: Comprehensive DTO validation
- **SQL Injection Prevention**: Prisma ORM protection

### 3. Access Control

- **JWT Authentication**: Required for all endpoints
- **Role-Based Guards**: Strict role enforcement
- **Root API Key**: Required for admin role changes

### 4. Account Management

- **Status Control**: Active/inactive account management
- **Duplicate Prevention**: Email uniqueness enforcement
- **Soft Delete**: Account deactivation instead of deletion

## Database Schema

### User Model

```prisma
model User {
  id               String            @id @default(cuid())
  email            String            @unique
  password         String
  firstName        String
  lastName         String
  phone            String
  role             UserRole          @default(USER)
  city             String?
  address          String?
  bio              String?
  profilePicture   String?
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  orders           Order[]
  aiConversations  AIConversation[]
  passwordResetOTP PasswordResetOTP?
}
```

### PasswordResetOTP Model

```prisma
model PasswordResetOTP {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  otp       String
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

## Error Handling

### Common Exceptions

- `NotFoundException`: User not found
- `ConflictException`: Duplicate email during creation
- `UnauthorizedException`: Insufficient permissions
- `BadRequestException`: Invalid input data

### Error Response Format

```typescript
{
  success: false,
  message: "Error description",
  data: null
}
```

## Integration Points

### 1. Authentication Module

- User creation during registration
- Password verification for login
- Password reset operations

### 2. Notification Module

- Welcome email sending
- Password reset email delivery

### 3. Common Module

- Role-based guards
- Custom decorators
- Response formatting

### 4. Prisma Module

- Database operations
- Schema management
- Migration handling

## Testing Considerations

### Unit Tests

- UserService method testing
- Repository layer testing
- DTO validation testing

### Integration Tests

- End-to-end user operations
- Role-based access testing
- Database operation testing

### Security Tests

- Password hashing verification
- Role-based access control
- Input validation testing

## Performance Considerations

### 1. Database Optimization

- Indexed email field for fast lookups
- Pagination for large user lists
- Efficient filtering queries

### 2. Caching Strategy

- User profile caching
- Session management
- Query result caching

### 3. Data Filtering

- Automatic sensitive data removal
- Efficient data transformation
- Minimal data transfer

## Best Practices

1. **Data Validation**: Comprehensive input validation with class-validator
2. **Security**: Always hash passwords and filter sensitive data
3. **Error Handling**: Provide meaningful error messages
4. **Access Control**: Implement strict role-based permissions
5. **Performance**: Use pagination and efficient queries
6. **Testing**: Comprehensive test coverage for all operations
7. **Documentation**: Clear API documentation and code comments
