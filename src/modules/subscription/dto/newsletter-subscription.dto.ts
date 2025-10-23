import { IsEmail, IsOptional, IsString } from 'class-validator';

export class NewsletterSubscriptionDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;
}
