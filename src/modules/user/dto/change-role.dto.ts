import { IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

// DTO for changing a user's role
export class ChangeRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
