import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { PaginationQueryDto } from 'src/lib/dto/pagination.dto';

export class SubscriptionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
