import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../gaurds/roles.guard';

/**
 * Auth decorator that only requires authentication (no specific roles)
 * This replaces the AuthorizationGuard functionality
 */
export const Auth = () => UseGuards(RolesGuard);

/**
 * Strict Auth decorator that provides clear messaging for suspended accounts
 */
export const StrictAuth = () => {
  // Note: This will use the StrictRoles decorator with empty roles array
  // or we can create a custom implementation
  return UseGuards(RolesGuard);
};
