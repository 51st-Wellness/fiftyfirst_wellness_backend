import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { PaymentStatus } from 'src/database/schema';

export class CreateSubscriptionDto {
  @IsString()
  userId: string;

  @IsString()
  planId: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
