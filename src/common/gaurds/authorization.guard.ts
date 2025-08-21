import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JWT_COOKIE_NAME, JWT_SYMBOL } from 'src/common/constants.common';
import { UserService } from 'src/modules/user/user.service';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    @Inject(JWT_SYMBOL) private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as Request;
    // * check if the request cookie has the JWT token
    let token = request.cookies?.[JWT_COOKIE_NAME];

    // * if not, check the Authorization header (sessions)
    if (!token) {
      const authHeader = request.headers.authorization;
      token = authHeader?.split(' ')[1];
    }
    if (!token) {
      console.error('JWT token is missing in cookies or Authorization header');
      return false;
    }

    try {
      const decoded = this.jwtService.verify(token);
      if (!decoded) {
        return false;
      }
      let user = { id: decoded.sub };
      const dbUser = await this.userService.findOne(user.id);
      if (!dbUser) {
        throw new UnauthorizedException('User not found');
      }
      request.user = dbUser; // Attach the user to the request object
      return true;
    } catch (error) {
      console.error('Error verifying JWT token:', (error as any).message);
      return false;
    }
  }
}
