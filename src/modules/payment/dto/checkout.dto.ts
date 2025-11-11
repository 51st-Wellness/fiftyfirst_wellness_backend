import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class SubscriptionCheckoutDto {
  // @IsString()
  // @IsNotEmpty()
  // userId: string; // User ID for subscription

  @IsString()
  @IsNotEmpty()
  planId: string; // Subscription plan ID
}

export class PaymentSuccessDto {
  @IsString()
  @IsNotEmpty()
  token: string; // PayPal order token/id
}

export class CartCheckoutDto {
  @IsString()
  contactName?: string; // Optional contact name override

  @IsString()
  contactPhone?: string; // Optional contact phone override

  @IsString()
  deliveryAddress?: string; // Optional delivery address override

  @IsString()
  deliveryCity?: string; // Optional delivery city override

  @IsOptional()
  @IsString()
  deliveryInstructions?: string; // Optional delivery instructions
}
