import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/modules/user/dto/create-user.dto';
import { LoginDto } from 'src/modules/user/dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { JWT_COOKIE_NAME } from 'src/common/constants.common';
import { AuthorizationGuard } from 'src/common/gaurds/authorization.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Register a new user
  @Post('register')
  async register(@Body() body: CreateUserDto) {
    const user = await this.authService.register(body);
    return { user };
  }

  // Login with email and password using local strategy
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = req.user as any;
    const accessToken = await this.authService.issueAccessToken(user);
    res.cookie(JWT_COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60,
      path: '/',
    });
    return { accessToken, user };
  }

  // Get the current authenticated user's profile
  @UseGuards(AuthorizationGuard)
  @Get('profile')
  async profile(@Req() req: Request) {
    return { user: req.user };
  }

  // Clear the auth cookie
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(JWT_COOKIE_NAME, { path: '/' });
    return { success: true };
  }
}
