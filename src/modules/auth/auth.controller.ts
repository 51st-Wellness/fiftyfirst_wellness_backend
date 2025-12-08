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
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { ForgetPasswordDto } from 'src/modules/user/dto/forget-password.dto';
import { ResetPasswordDto } from 'src/modules/user/dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { AuthGuard } from '@nestjs/passport';
import { JWT_COOKIE_NAME } from 'src/config/constants.config';
import { User } from 'src/database/types';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import { ResponseDto } from 'src/util/dto/response.dto';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AppConfig } from 'src/config/app.config';
import { OAuth2Client } from 'google-auth-library';
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // Register a new user
  @Post('signup')
  async register(
    @Body() body: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const newUser = await this.authService.register(body);

    // Automatically sign in the user by setting JWT cookie
    const accessToken = await this.authService.issueAccessTokenWithCookie(
      newUser,
      res,
    );

    return ResponseDto.createSuccessResponse(
      'Signup Successful, an Email Verification OTP has been sent to your email',
      {
        user: newUser,
        accessToken,
      },
    );
  }

  // Login with email and password using local strategy
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(
    @Req() req: Request,
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as User;
    const accessToken = await this.authService.issueAccessTokenWithCookie(
      user,
      res,
    );

    // Handle bulk cart items if provided
    if (body.cartItems && body.cartItems.length > 0) {
      await this.authService.handleBulkCartItems(user.id, body.cartItems);
    }

    // Send login reminder email (for testing purposes)
    // await this.authService.sendLoginReminder(user);

    return ResponseDto.createSuccessResponse('Login successful', {
      user,
      accessToken,
    });
  }

  // Check authentication status without returning user data
  @Get('check')
  @UseGuards(AuthGuard('jwt'))
  async checkAuth() {
    return ResponseDto.createSuccessResponse('User is authenticated', {
      authenticated: true,
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
    const user = await this.authService.verifyEmailWithOTP(
      verifyEmailDto.email,
      verifyEmailDto.otp,
    );
    const accessToken = await this.authService.issueAccessToken(user);
    return ResponseDto.createSuccessResponse('Email verified successfully', {
      user,
      accessToken,
    });
  }

  // Resend email verification OTP
  @Post('resend-verification')
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ) {
    await this.authService.generateEmailVerificationOTP(
      resendVerificationDto.email,
    );
    return ResponseDto.createSuccessResponse(
      'Email verification OTP sent to your email',
    );
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: Request) {}

  // Google OAuth callback route
  @Get('callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as any;

    console.log('user', user);

    // Generate access token
    const accessToken = await this.authService.issueAccessToken(user);

    // Set cookie for backend authentication
    await this.authService.issueAccessTokenWithCookie(user, res);

    // Redirect to auth success page with token as query param
    const frontendUrl =
      this.configService.get(ENV.FRONTEND_URL) || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/success?token=${encodeURIComponent(accessToken)}`;

    console.log(`🔄 Google OAuth Success - Redirecting to: ${redirectUrl}`);
    res.redirect(redirectUrl);
  }

  // Google One Tap authentication endpoint
  @Post('google/onetap')
  async googleOneTap(
    @Body()
    body: {
      token: string;
      cartItems?: { productId: string; quantity: number }[];
    },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      // Use Google's OAuth2 client to verify the ID token
      const client = new OAuth2Client(
        this.configService.get(ENV.GOOGLE_CLIENT_ID),
      );

      const ticket = await client.verifyIdToken({
        idToken: body.token,
        audience: this.configService.get(ENV.GOOGLE_CLIENT_ID),
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google token');
      }

      // Extract user information
      const email = payload.email;
      const firstName = payload.given_name || '';
      const lastName = payload.family_name || '';
      const googleId = payload.sub;
      const profilePicture = payload.picture;

      if (!email) {
        throw new UnauthorizedException('No email found in Google profile');
      }

      // Validate or create user
      const user = await this.authService.validateUserWithGoogle(
        email,
        firstName,
        lastName,
        googleId,
        profilePicture,
      );

      // Handle bulk cart items if provided
      if (body.cartItems && body.cartItems.length > 0) {
        await this.authService.handleBulkCartItems(user.id, body.cartItems);
      }

      // Generate access token and set cookie
      const accessToken = await this.authService.issueAccessTokenWithCookie(
        user,
        res,
      );

      return ResponseDto.createSuccessResponse(
        'Google One Tap authentication successful',
        {
          user,
          accessToken,
        },
      );
    } catch (error) {
      console.error('Google One Tap error:', error);
      throw new UnauthorizedException('Google authentication failed');
    }
  }
}
