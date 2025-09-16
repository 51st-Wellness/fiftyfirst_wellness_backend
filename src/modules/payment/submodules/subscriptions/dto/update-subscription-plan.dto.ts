import { PartialType } from '@nestjs/mapped-types';
import { CreateSubscriptionPlanDto } from './create-subscription-plan.dto';
import { IsOptional, IsArray, IsEnum } from 'class-validator';
import { AccessItem } from 'src/database/schema';

export class UpdateSubscriptionPlanDto extends PartialType(
  CreateSubscriptionPlanDto,
) {
  @IsOptional()
  @IsArray()
  @IsEnum(AccessItem, { each: true })
  accessItems?: AccessItem[];
}
