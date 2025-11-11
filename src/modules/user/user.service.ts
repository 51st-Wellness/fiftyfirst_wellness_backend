import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { CreateDeliveryAddressDto } from './dto/create-delivery-address.dto';
import { UpdateDeliveryAddressDto } from './dto/update-delivery-address.dto';
import { User } from 'src/database/types';
import { UserRole } from 'src/database/schema';
import * as bcrypt from 'bcrypt';
import { DataFormatter } from 'src/lib/helpers/data-formater.helper';
import { ProgrammeRepository } from 'src/modules/product/submodules/programme/programme.repository';
import { StoreRepository } from 'src/modules/product/submodules/store/store.repository';
import { DatabaseService } from 'src/database/database.service';
import { deliveryAddresses } from 'src/database/schema';
import { eq, and, sql, desc, ne } from 'drizzle-orm';
import { generateId } from 'src/database/utils';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly programmeRepository: ProgrammeRepository,
    private readonly storeRepository: StoreRepository,
    private readonly database: DatabaseService,
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

  // Delivery Address CRUD operations

  // Get all delivery addresses for a user (excluding soft deleted)
  async getDeliveryAddresses(userId: string) {
    return await this.database.db
      .select()
      .from(deliveryAddresses)
      .where(
        and(
          eq(deliveryAddresses.userId, userId),
          sql`${deliveryAddresses.deletedAt} IS NULL`,
        ),
      )
      .orderBy(
        desc(deliveryAddresses.isDefault),
        desc(deliveryAddresses.createdAt),
      );
  }

  // Get a single delivery address by ID
  async getDeliveryAddress(addressId: string, userId: string) {
    const address = (
      await this.database.db
        .select()
        .from(deliveryAddresses)
        .where(
          and(
            eq(deliveryAddresses.id, addressId),
            eq(deliveryAddresses.userId, userId),
            sql`${deliveryAddresses.deletedAt} IS NULL`,
          ),
        )
        .limit(1)
    )[0];

    if (!address) {
      throw new NotFoundException('Delivery address not found');
    }

    return address;
  }

  // Create a new delivery address
  async createDeliveryAddress(
    userId: string,
    createDto: CreateDeliveryAddressDto,
  ) {
    // If setting as default, unset other defaults
    if (createDto.isDefault) {
      await this.database.db
        .update(deliveryAddresses)
        .set({ isDefault: false })
        .where(
          and(
            eq(deliveryAddresses.userId, userId),
            sql`${deliveryAddresses.deletedAt} IS NULL`,
          ),
        );
    }

    const addressId = generateId();
    const [address] = await this.database.db
      .insert(deliveryAddresses)
      .values({
        id: addressId,
        userId,
        contactName: createDto.contactName,
        contactPhone: createDto.contactPhone,
        deliveryAddress: createDto.deliveryAddress,
        deliveryCity: createDto.deliveryCity,
        deliveryInstructions: createDto.deliveryInstructions,
        isDefault: createDto.isDefault ?? false,
      })
      .returning();

    return address;
  }

  // Update a delivery address
  async updateDeliveryAddress(
    addressId: string,
    userId: string,
    updateDto: UpdateDeliveryAddressDto,
  ) {
    // Verify address exists and belongs to user
    const existingAddress = await this.getDeliveryAddress(addressId, userId);

    // If setting as default, unset other defaults (excluding current address)
    if (updateDto.isDefault === true) {
      await this.database.db
        .update(deliveryAddresses)
        .set({ isDefault: false })
        .where(
          and(
            eq(deliveryAddresses.userId, userId),
            ne(deliveryAddresses.id, addressId),
            sql`${deliveryAddresses.deletedAt} IS NULL`,
          ),
        );
    }

    const [updatedAddress] = await this.database.db
      .update(deliveryAddresses)
      .set({
        ...(updateDto.contactName && { contactName: updateDto.contactName }),
        ...(updateDto.contactPhone && { contactPhone: updateDto.contactPhone }),
        ...(updateDto.deliveryAddress && {
          deliveryAddress: updateDto.deliveryAddress,
        }),
        ...(updateDto.deliveryCity && { deliveryCity: updateDto.deliveryCity }),
        ...(updateDto.deliveryInstructions !== undefined && {
          deliveryInstructions: updateDto.deliveryInstructions,
        }),
        ...(updateDto.isDefault !== undefined && {
          isDefault: updateDto.isDefault,
        }),
      })
      .where(eq(deliveryAddresses.id, addressId))
      .returning();

    return updatedAddress;
  }

  // Soft delete a delivery address
  async deleteDeliveryAddress(addressId: string, userId: string) {
    // Verify address exists and belongs to user
    await this.getDeliveryAddress(addressId, userId);

    // Soft delete by setting deletedAt
    const [deletedAddress] = await this.database.db
      .update(deliveryAddresses)
      .set({ deletedAt: new Date() })
      .where(eq(deliveryAddresses.id, addressId))
      .returning();

    return deletedAddress;
  }
}
