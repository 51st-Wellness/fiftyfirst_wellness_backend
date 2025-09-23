import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/modules/user/user.service';
import { CreateUserDto } from 'src/modules/user/dto/create-user.dto';
import { User } from 'src/database/types';
import { Response } from 'express';
import { JWT_COOKIE_NAME } from 'src/config/constants.config';
import { EventsEmitter } from 'src/util/events/events.emitter';
import { EmailType } from 'src/modules/notification/email/constants/email.enum';
import * as crypto from 'crypto';
import { DataFormatter } from 'src/lib/helpers/data-formater.helper';
import { JWT_SERVICE } from 'src/config/constants.config';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(JWT_SERVICE) private readonly jwtService: JwtService,
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

    // Check if user account is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isValid = await this.userService.verifyPassword(user, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const { password: _pwd, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Register a user and return the created user without password
  async register(createUserDto: SignupDto): Promise<Omit<User, 'password'>> {
    const user = await this.userService.create(createUserDto);

    // Generate and send email verification OTP for regular users (not Google OAuth)
    if (!user.googleId) {
      await this.generateEmailVerificationOTP(user.email);
    }

    // Send welcome email based on user role
    const emailType =
      user.role === 'ADMIN' ? EmailType.WELCOME_ADMIN : EmailType.WELCOME_USER;

    this.eventsEmitter.sendEmail({
      to: user.email,
      type: emailType,
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

  // Send login reminder email (for testing purposes)
  async sendLoginReminder(user: Omit<User, 'password'>): Promise<void> {
    this.eventsEmitter.sendEmail({
      to: user.email,
      type: EmailType.LOGIN_REMINDER,
      context: {
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  }

  // Generate and store OTP for email verification
  async generateEmailVerificationOTP(email: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store OTP in database
    await this.userService.storeEmailVerificationOTP(user.id, otp, expiresAt);

    // Send email verification email
    this.eventsEmitter.sendEmail({
      to: user.email,
      type: EmailType.EMAIL_VERIFICATION,
      context: {
        firstName: user.firstName,
        lastName: user.lastName,
        otp: otp,
      },
    });
  }

  // Verify OTP and mark email as verified
  async verifyEmailWithOTP(email: string, otp: string): Promise<void> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Verify OTP
    const isValidOTP = await this.userService.verifyEmailVerificationOTP(
      user.id,
      otp,
    );
    if (!isValidOTP) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Mark email as verified and clear OTP
    await this.userService.markEmailAsVerified(user.id);

    // Send verification success email
    this.eventsEmitter.sendEmail({
      to: user.email,
      type: EmailType.EMAIL_VERIFICATION_SUCCESS,
      context: {
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  }

  // Resend email verification OTP
  async resendEmailVerificationOTP(email: string): Promise<void> {
    await this.generateEmailVerificationOTP(email);
  }

  // Validate user with Google OAuth profile
  async validateUserWithGoogle(
    email: string,
    firstName: string,
    lastName: string,
    googleId: string,
    profilePicture?: string,
  ): Promise<Omit<User, 'password'>> {
    // Check if user exists by googleId
    let user = await this.userService.findByGoogleId(googleId);
    if (user) {
      // Update profile picture if provided and different
      if (profilePicture && user.profilePicture !== profilePicture) {
        let userWithoutPassword = await this.userService.updateProfile(
          user.id,
          {
            profilePicture,
          },
        );
        return userWithoutPassword;
      }
      return DataFormatter.formatObject(user, ['password']);
    }

    // Check if user exists by email
    try {
      user = await this.userService.findByEmail(email);
      if (user) {
        // Link Google ID to existing account
        let userWithoutPassword = await this.userService.updateProfile(
          user.id,
          {
            googleId,
            profilePicture: profilePicture || user.profilePicture || undefined,
          },
        );
        return userWithoutPassword;
      }
    } catch (error) {
      // User not found by email, continue to create new user
    }

    // Create new user with Google profile
    const newUser = await this.userService.create({
      email,
      firstName,
      lastName,
      googleId,
      profilePicture: profilePicture,
      role: 'USER' as any,
      // phone: null, // Can be added later by user
    });

    // Mark email as verified for Google OAuth users
    await this.userService.markEmailAsVerified(newUser.id);

    // Send welcome email
    this.eventsEmitter.sendEmail({
      to: newUser.email,
      type: EmailType.WELCOME_USER,
      context: {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      },
    });

    return newUser;
  }
}
