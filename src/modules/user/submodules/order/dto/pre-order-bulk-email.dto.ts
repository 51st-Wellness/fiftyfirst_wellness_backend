import { IsString, IsOptional } from 'class-validator';

export class PreOrderBulkEmailDto {
  @IsString()
  productId: string;

  @IsString()
  subject: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  preOrderStatus?: string;
}
