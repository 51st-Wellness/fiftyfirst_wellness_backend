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
  @IsOptional()
  @IsString()
  deliveryAddressId?: string; // Use existing delivery address

  // Custom address fields (used when creating new address)
  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  postTown?: string;

  @IsOptional()
  @IsString()
  postcode?: string;

  @IsOptional()
  @IsString()
  deliveryInstructions?: string;

  @IsOptional()
  saveAddress?: boolean; // Whether to save the custom address
}
