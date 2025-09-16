import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'src/database/schema';

export const ROLES_KEY = 'roles';
export const STRICT_MODE_KEY = 'strict_mode';

/**
 * Roles decorator for specifying which user roles can access an endpoint
 * @param roles List of roles that are authorized to access the route
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Strict Roles decorator that blocks deactivated accounts with clear messaging
 * @param roles List of roles that are authorized to access the route
 */
export const StrictRoles = (...roles: UserRole[]) => {
  return (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) => {
    SetMetadata(ROLES_KEY, roles)(target, propertyKey!, descriptor!);
    SetMetadata(STRICT_MODE_KEY, true)(target, propertyKey!, descriptor!);
  };
};
