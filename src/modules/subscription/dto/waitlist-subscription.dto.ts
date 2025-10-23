import { IsEmail, IsOptional, IsString } from 'class-validator';

export class WaitlistSubscriptionDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;
}
