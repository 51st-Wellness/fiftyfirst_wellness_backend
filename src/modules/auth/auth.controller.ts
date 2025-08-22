import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/modules/user/dto/create-user.dto';
import { LoginDto } from 'src/modules/user/dto/login.dto';
import { ForgetPasswordDto } from 'src/modules/user/dto/forget-password.dto';
import { ResetPasswordDto } from 'src/modules/user/dto/reset-password.dto';
import { AuthGuard } from '@nestjs/passport';
import { JWT_COOKIE_NAME } from 'src/config/constants.config';
import { AuthorizationGuard } from 'src/common/gaurds/authorization.guard';
import { User, UserRole } from '@prisma/client';
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
        req.headers['root-api-key'] !==
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

    return ResponseDto.createSuccessResponse('Login successful', {
      user,
      accessToken,
    });
  }

  // Get the current authenticated user's profile
  @UseGuards(AuthorizationGuard)
  @Get('profile')
  async profile(@Req() req: Request) {
    return ResponseDto.createSuccessResponse('Profile retrieved successfully', {
      user: req.user,
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
}
