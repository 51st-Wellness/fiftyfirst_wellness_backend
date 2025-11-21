import { IsString, IsOptional } from 'class-validator';
import { PreOrderStatus } from 'src/database/schema';

export class PreOrderBulkEmailDto {
  @IsString()
  productId: string;

  @IsString()
  subject: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  preOrderStatus?: PreOrderStatus;
}
