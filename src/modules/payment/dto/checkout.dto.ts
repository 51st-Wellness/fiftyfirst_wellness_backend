import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class SubscriptionCheckoutDto {
  @IsString()
  @IsNotEmpty()
  userId: string; // User ID for subscription

  @IsString()
  @IsNotEmpty()
  planId: string; // Subscription plan ID

  @IsOptional()
  @IsString()
  description?: string; // Optional description for the payment
}

export class PaymentSuccessDto {
  @IsString()
  @IsNotEmpty()
  token: string; // PayPal order token/id
}
