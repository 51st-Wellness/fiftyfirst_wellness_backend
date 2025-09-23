import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  Get,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/modules/user/dto/create-user.dto';
import { ForgetPasswordDto } from 'src/modules/user/dto/forget-password.dto';
import { ResetPasswordDto } from 'src/modules/user/dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { AuthGuard } from '@nestjs/passport';
import { CUSTOM_HEADERS, JWT_COOKIE_NAME } from 'src/config/constants.config';
import { User } from 'src/database/types';
import { UserRole } from 'src/database/schema';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import { ResponseDto } from 'src/util/dto/response.dto';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // Register a new user
  @Post('signup')
  async register(
    @Body() body: CreateUserDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (body.role === UserRole.ADMIN) {
      if (
        req.headers[CUSTOM_HEADERS.rootApiKey] !==
        (this.configService.get(ENV.ROOT_API_KEY) as string)
      ) {
        throw new UnauthorizedException('Invalid root api key');
      }
    }
    const newUser = await this.authService.register(body);

    // Automatically sign in the user by setting JWT cookie
    const accessToken = await this.authService.issueAccessTokenWithCookie(
      newUser,
      res,
    );

    return ResponseDto.createSuccessResponse('User registered successfully', {
      user: newUser,
      accessToken,
    });
  }

  // Login with email and password using local strategy
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as User;
    const accessToken = await this.authService.issueAccessTokenWithCookie(
      user,
      res,
    );

    // Send login reminder email (for testing purposes)
    await this.authService.sendLoginReminder(user);

    return ResponseDto.createSuccessResponse('Login successful', {
      user,
      accessToken,
    });
  }

  // Clear the auth cookie
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(JWT_COOKIE_NAME, { path: '/' });
    return ResponseDto.createSuccessResponse('Logout successful');
  }

  // Request password reset OTP
  @Post('forget-password')
  async forgetPassword(@Body() forgetPasswordDto: ForgetPasswordDto) {
    await this.authService.generatePasswordResetOTP(forgetPasswordDto.email);
    return ResponseDto.createSuccessResponse(
      'Password reset OTP sent to your email',
    );
  }

  // Reset password with OTP
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPasswordWithOTP(
      resetPasswordDto.email,
      resetPasswordDto.otp,
      resetPasswordDto.newPassword,
    );
    return ResponseDto.createSuccessResponse('Password reset successfully');
  }

  // Verify email with OTP
  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    await this.authService.verifyEmailWithOTP(
      verifyEmailDto.email,
      verifyEmailDto.otp,
    );
    return ResponseDto.createSuccessResponse('Email verified successfully');
  }

  // Resend email verification OTP
  @Post('resend-verification')
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ) {
    await this.authService.resendEmailVerificationOTP(
      resendVerificationDto.email,
    );
    return ResponseDto.createSuccessResponse(
      'Email verification OTP sent to your email',
    );
  }

  // Google OAuth initiation route - intelligently detects origin
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: Request) {
    // Strategic origin detection for dev/prod environments
    const detectedOrigin = this.detectOrigin(req);

    // Pass origin as state parameter for OAuth flow
    req.query.state = detectedOrigin;
  }

  // Helper method to strategically detect request origin
  private detectOrigin(req: Request): string {
    // 1. Check if explicitly provided in query params (manual override)
    if (req.query.origin && typeof req.query.origin === 'string') {
      return this.validateAndSanitizeOrigin(req.query.origin);
    }

    const referer = req.headers.referer;
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
        return this.validateAndSanitizeOrigin(refererOrigin);
      } catch (error) {
        // Invalid referer URL, fall through to next detection method
      }
    }

    const origin = req.headers.origin;
    if (origin) {
      return this.validateAndSanitizeOrigin(origin);
    }

    const host = req.headers.host;
    if (host) {
      const protocol =
        req.secure || req.headers['x-forwarded-proto'] === 'https'
          ? 'https'
          : 'http';
      const hostOrigin = `${protocol}://${host}`;
      return this.validateAndSanitizeOrigin(hostOrigin);
    }

    return this.getDefaultOrigin();
  }

  // Validate and sanitize origin against allowed domains
  private validateAndSanitizeOrigin(origin: string): string {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Common Vite dev server
      'http://localhost:4200', // Angular dev server
      this.configService.get(ENV.FRONTEND_URL),
      this.configService.get(ENV.PRODUCTION_URL),
      this.configService.get(ENV.DEVELOPMENT_URL),
    ].filter(Boolean); // Remove any undefined values

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return origin;
    }

    // Check for localhost with different ports (development)
    if (origin.match(/^https?:\/\/localhost:\d+$/)) {
      return origin;
    }

    // Fallback to default if not in allowed list
    return this.getDefaultOrigin();
  }

  // Get default origin based on environment
  private getDefaultOrigin(): string {
    const nodeEnv = process.env.NODE_ENV || 'development';

    if (nodeEnv === 'production') {
      return this.configService.get(ENV.FRONTEND_URL);
    } else {
      return (
        this.configService.get(ENV.DEVELOPMENT_URL) || 'http://localhost:3000'
      );
    }
  }

  // Google OAuth callback route - uses preserved origin for intelligent redirect
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userWithOrigin = req.user as any;

    if (!userWithOrigin) {
      throw new UnauthorizedException(
        'Google authentication failed: No user profile returned.',
      );
    }

    // Extract user data (remove internal origin info)
    const { _redirectOrigin, ...user } = userWithOrigin;

    // Generate access token and set cookie
    const accessToken = await this.authService.issueAccessTokenWithCookie(
      user,
      res,
    );

    // Determine redirect URL based on preserved origin or fallback to state
    const redirectOrigin =
      _redirectOrigin || req.query.state || this.getDefaultOrigin();

    // Validate the redirect origin again for security
    const safeRedirectOrigin = this.validateAndSanitizeOrigin(
      redirectOrigin as string,
    );

    // Construct final redirect URL
    const redirectUrl = `${safeRedirectOrigin}/auth/success`;

    console.log(`🔄 Google OAuth Success - Redirecting to: ${redirectUrl}`);
    res.status(HttpStatus.FOUND).redirect(redirectUrl);
  }
}
