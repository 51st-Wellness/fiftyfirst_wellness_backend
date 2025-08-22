import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/modules/user/user.service';
import { CreateUserDto } from 'src/modules/user/dto/create-user.dto';
import { User } from '@prisma/client';
import { Response } from 'express';
import { JWT_COOKIE_NAME } from 'src/config/constants.config';
import { EventsEmitter } from 'src/util/events/events.emitter';
import { EmailType } from 'src/modules/notification/email/constants/email.enum';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly eventsEmitter: EventsEmitter,
  ) {}

  // Validate provided credentials against stored user credentials
  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isValid = await this.userService.verifyPassword(user, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const { password: _pwd, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Register a user and return the created user without password
  async register(
    createUserDto: CreateUserDto,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.userService.create(createUserDto);

    // Send welcome email via event emitter
    this.eventsEmitter.sendEmail({
      to: user.email,
      type: EmailType.WELCOME_STUDENT,
      context: {
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

    return user;
  }

  // Issue a signed JWT access token for the user and set cookie
  async issueAccessTokenWithCookie(
    user: Omit<User, 'password'>,
    res: Response,
  ): Promise<string> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    // Set JWT cookie
    res.cookie(JWT_COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60, // 1 hour
      path: '/',
    });

    return accessToken;
  }

  // Issue a signed JWT access token for the user (without cookie)
  async issueAccessToken(user: Omit<User, 'password'>): Promise<string> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.signAsync(payload);
  }

  // Generate and store OTP for password reset
  async generatePasswordResetOTP(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store OTP in database
    await this.userService.storePasswordResetOTP(user.id, otp, expiresAt);

    // Send password reset email
    this.eventsEmitter.sendEmail({
      to: user.email,
      type: EmailType.PASSWORD_RESET,
      context: {
        firstName: user.firstName,
        lastName: user.lastName,
        otp: otp,
      },
    });
  }

  // Verify OTP and reset password
  async resetPasswordWithOTP(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    // Verify OTP
    const isValidOTP = await this.userService.verifyPasswordResetOTP(
      user.id,
      otp,
    );
    if (!isValidOTP) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Update password and clear OTP
    await this.userService.resetPassword(user.id, newPassword);
  }
}
