import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from 'src/database/types';

/**
 * Extract current user (or a specific property) from request object.
 * Usage:
 *   @CurrentUser() user: User
 *   @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User | undefined;

    if (!user) {
      return null;
    }

    if (data) {
      return user[data];
    }

    return user;
  },
);
