import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Create a new user
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  // Find user by ID
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // Find all users with optional pagination
  async findAll(skip?: number, take?: number): Promise<User[]> {
    return this.prisma.user.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Update user by ID
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  // Delete user by ID
  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }

  // Find user by ID with related data
  async findByIdWithRelations(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: true,
        aiConversations: true,
      },
    });
  }

  // Store password reset OTP (upsert to handle existing OTP)
  async storePasswordResetOTP(
    userId: string,
    otp: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.passwordResetOTP.upsert({
      where: { userId },
      update: { otp, expiresAt },
      create: { userId, otp, expiresAt },
    });
  }

  // Verify password reset OTP
  async verifyPasswordResetOTP(userId: string, otp: string): Promise<boolean> {
    const otpRecord = await this.prisma.passwordResetOTP.findUnique({
      where: { userId },
    });

    if (!otpRecord) {
      return false;
    }

    // Check if OTP matches and hasn't expired
    const isValid = otpRecord.otp === otp && otpRecord.expiresAt > new Date();
    return isValid;
  }

  // Reset password and clear OTP
  async resetPassword(userId: string, hashedPassword: string): Promise<void> {
    await this.prisma.$transaction([
      // Update password
      this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      }),
      // Delete the OTP record
      this.prisma.passwordResetOTP.delete({
        where: { userId },
      }),
    ]);
  }

  // Find users with pagination and filters
  async findManyWithFilters(
    page: number = 1,
    pageSize: number = 10,
    filters: {
      search?: string;
      role?: string;
      isActive?: boolean;
    } = {},
  ): Promise<{ users: User[]; total: number }> {
    const skip = (page - 1) * pageSize;

    const where: any = {};

    // Apply filters
    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  // Toggle user active status
  async toggleUserStatus(userId: string, isActive: boolean): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }
}
