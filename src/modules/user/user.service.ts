import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User } from 'src/database/types';
import { UserRole } from 'src/database/schema';
import * as bcrypt from 'bcrypt';
import { DataFormatter } from 'src/lib/helpers/data-formater.helper';
import { ProgrammeRepository } from 'src/modules/product/submodules/programme/programme.repository';
import { StoreRepository } from 'src/modules/product/submodules/store/store.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly programmeRepository: ProgrammeRepository,
    private readonly storeRepository: StoreRepository,
  ) {}

  // Create a new user with password hashing
  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const { email, password, ...userData } = createUserDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password if provided (optional for Google OAuth users)
    let hashedPassword: string | undefined;
    if (password) {
      const saltRounds = 12;
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    // Create user
    const user = await this.userRepository.create({
      ...userData,
      email,
      password: hashedPassword,
    });

    // Return user without sensitive data
    return DataFormatter.formatObject(user, ['password']);
  }

  // Find user by ID
  async findOne(id: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      return null;
    }

    return DataFormatter.formatObject(user, ['password']);
  }

  // Find user by email (for authentication)
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  // Find user by Google ID
  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findByGoogleId(googleId);
  }

  // Find all users with pagination
  async findAll(
    skip?: number,
    take?: number,
  ): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository.findAll(skip, take);
    return users.map((user) => DataFormatter.formatObject(user, ['password']));
  }

  // Update user
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<Omit<User, 'password'>> {
    const { password, ...updateData } = updateUserDto;

    // If password is being updated, hash it
    let hashedPassword: string | undefined;
    if (password) {
      const saltRounds = 12;
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    const user = await this.userRepository.update(id, {
      ...updateData,
      ...(hashedPassword && { password: hashedPassword }),
    });

    return DataFormatter.formatObject(user, ['password']);
  }

  // Delete user
  async remove(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.delete(id);
    return DataFormatter.formatObject(user, ['password']);
  }

  // Verify password for authentication
  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.password) {
      // User has no password (Google OAuth user)
      return false;
    }
    return bcrypt.compare(password, user.password);
  }

  // Find user with relations
  async findOneWithRelations(
    id: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepository.findByIdWithRelations(id);
    if (!user) {
      return null;
    }

    return DataFormatter.formatObject(user, ['password']);
  }

  // Store password reset OTP
  async storePasswordResetOTP(
    userId: string,
    otp: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userRepository.storePasswordResetOTP(userId, otp, expiresAt);
  }

  // Verify password reset OTP
  async verifyPasswordResetOTP(userId: string, otp: string): Promise<boolean> {
    return this.userRepository.verifyPasswordResetOTP(userId, otp);
  }

  // Reset password and clear OTP
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    await this.userRepository.resetPassword(userId, hashedPassword);
  }

  // Store email verification OTP
  async storeEmailVerificationOTP(
    userId: string,
    otp: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userRepository.storeEmailVerificationOTP(userId, otp, expiresAt);
  }

  // Verify email verification OTP
  async verifyEmailVerificationOTP(
    userId: string,
    otp: string,
  ): Promise<boolean> {
    return this.userRepository.verifyEmailVerificationOTP(userId, otp);
  }

  // Mark email as verified
  async markEmailAsVerified(userId: string): Promise<void> {
    await this.userRepository.markEmailAsVerified(userId);
  }

  // Update user profile
  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.update(userId, updateProfileDto);

    return DataFormatter.formatObject(user, ['password']);
  }

  // Find users with pagination and filters (Admin only)
  async findManyWithFilters(
    query: UserQueryDto,
  ): Promise<{ users: Omit<User, 'password'>[]; total: number }> {
    const { page = 1, pageSize = 10, search, role, isActive } = query;

    const { users, total } = await this.userRepository.findManyWithFilters(
      page,
      pageSize,
      { search, role, isActive },
    );

    const formattedUsers = users.map((user) =>
      DataFormatter.formatObject(user, ['password']),
    );

    return { users: formattedUsers, total };
  }

  // Toggle user active status (Admin only)
  async toggleUserStatus(
    userId: string,
    isActive: boolean,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.toggleUserStatus(userId, isActive);
    return DataFormatter.formatObject(user, ['password']);
  }

  // Change user role (requires root api key at controller)
  async changeUserRole(
    userId: string,
    role: UserRole,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.update(userId, { role });
    return DataFormatter.formatObject(user, ['password']);
  }

  // Get platform statistics for admin dashboards
  async getStats(): Promise<{
    totalUsers: number;
    totalProgrammes: number;
    totalStoreItems: number;
  }> {
    const [totalUsers, totalProgrammes, totalStoreItems] = await Promise.all([
      this.userRepository.getTotalUsers(),
      this.programmeRepository.count(),
      this.storeRepository.count(),
    ]);
    return { totalUsers, totalProgrammes, totalStoreItems };
  }
}
