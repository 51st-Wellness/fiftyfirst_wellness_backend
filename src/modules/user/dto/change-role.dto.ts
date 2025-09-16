import { IsEnum } from 'class-validator';
import { UserRole } from 'src/database/schema';

// DTO for changing a user's role
export class ChangeRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
