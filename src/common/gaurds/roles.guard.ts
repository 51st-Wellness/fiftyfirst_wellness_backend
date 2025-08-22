import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JWT_SERVICE, JWT_COOKIE_NAME } from 'src/config/constants.config';
import {
  ROLES_KEY,
  STRICT_MODE_KEY,
} from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { UserService } from 'src/modules/user/user.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(JWT_SERVICE) private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the roles required for this route
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Check if strict mode is enabled for this route
    const strictMode =
      this.reflector.getAllAndOverride<boolean>(STRICT_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || false;

    const request = context.switchToHttp().getRequest();

    try {
      const user = await this.authenticateRequest(request);

      // Fetch the user with their role from the database
      const dbUser = await this.userService.findOne(user.id);
      if (!dbUser) {
        throw new UnauthorizedException('User not found');
      }

      // Handle account active status based on strict mode
      if (!dbUser.isActive) {
        if (strictMode) {
          // In strict mode, provide clear messaging about account suspension
          throw new ForbiddenException(
            'Your account has been suspended. Please contact support for assistance.',
          );
        } else {
          // In non-strict mode, treat as unauthorized
          throw new UnauthorizedException('Account is deactivated');
        }
      }

      request.user = dbUser;

      // If no specific roles are required, just having a valid token and active account is enough
      if (!requiredRoles || requiredRoles.length === 0) {
        return true;
      }

      // Check if the user's role matches any of the required roles
      const authorized = requiredRoles.includes(dbUser.role);
      if (!authorized) {
        throw new ForbiddenException(
          'You do not have permission to access this resource',
        );
      }
      return authorized;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async authenticateRequest(
    request: Request,
  ): Promise<{ id: string; role: UserRole }> {
    // Check if token exists in cookies or authorization header
    let token = request.cookies?.[JWT_COOKIE_NAME];

    if (!token) {
      const authHeader = request.headers.authorization;
      token = authHeader?.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedException('User not logged in');
    }

    try {
      const decoded = this.jwtService.verify(token);
      return {
        id: decoded.sub,
        role: decoded.role,
      };
    } catch (error) {
      throw new UnauthorizedException(
        'Invalid JWT token (Please signin to perform this operation)',
      );
    }
  }
}
