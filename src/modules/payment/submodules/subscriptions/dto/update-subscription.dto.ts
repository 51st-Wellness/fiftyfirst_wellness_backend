import { PartialType } from '@nestjs/mapped-types';
import { CreateSubscriptionDto } from './create-subscription.dto';
import { IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { PaymentStatus } from 'src/database/schema';

export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto) {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
