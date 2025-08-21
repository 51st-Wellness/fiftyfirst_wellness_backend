import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/modules/user/user.service';
import { CreateUserDto } from 'src/modules/user/dto/create-user.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  // Validate provided credentials against stored user credentials
  async validateUser(email: string, password: string): Promise<Omit<User, 'password'>> {
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
  async register(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    return this.userService.create(createUserDto);
  }

  // Issue a signed JWT access token for the user
  async issueAccessToken(user: Omit<User, 'password'>): Promise<string> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.signAsync(payload);
  }
}


