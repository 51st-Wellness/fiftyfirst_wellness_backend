import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  // Create a new user with password hashing
  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const { email, password, ...userData } = createUserDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await this.userRepository.create({
      ...userData,
      email,
      password: hashedPassword,
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Find user by ID
  async findOne(id: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Find user by email (for authentication)
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  // Find all users with pagination
  async findAll(
    skip?: number,
    take?: number,
  ): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository.findAll(skip, take);
    return users.map(
      ({ password, ...userWithoutPassword }) => userWithoutPassword,
    );
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

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Delete user
  async remove(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.delete(id);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Verify password for authentication
  async verifyPassword(user: User, password: string): Promise<boolean> {
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

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
