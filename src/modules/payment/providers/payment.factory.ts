import { ConfigService } from '@nestjs/config';
import { Provider, BadRequestException } from '@nestjs/common';
import { PAYMENT_PROVIDER_TOKEN, PaymentProvider } from './payment.types';
import { PayPalProvider } from './paypal/paypal.provider';
import { StripeProvider } from './stripe/stripe.provider';
import { ENV } from 'src/config/env.enum';

export const createPaymentProvider = (
  config: ConfigService,
): PaymentProvider => {
  const provider = (
    config.get<string>(ENV.PAYMENT_PROVIDER) || 'STRIPE'
  ).toUpperCase();

  switch (provider) {
    case 'PAYPAL':
      const clientId = config.get<string>(ENV.PAYPAL_CLIENT_ID)!;
      const clientSecret = config.get<string>(ENV.PAYPAL_CLIENT_SECRET)!;
      const mode = config.get<string>(ENV.PAYPAL_MODE) as 'sandbox' | 'live';
      const webhookId = config.get<string>(ENV.PAYPAL_WEBHOOK_ID)!;

      return new PayPalProvider(clientId, clientSecret, mode, webhookId);

    case 'STRIPE':
      const stripeSecret = config.get<string>(ENV.STRIPE_CLIENT_SECRETE)!;
      const stripeWebhookSecret = config.get<string>(
        ENV.STRIPE_WEBHOOK_SECRETE,
      );
      return new StripeProvider(stripeSecret, stripeWebhookSecret);

    default:
      throw new BadRequestException(
        `Unsupported payment provider: ${provider}`,
      );
  }
};

export const PaymentProviderBinding: Provider = {
  provide: PAYMENT_PROVIDER_TOKEN,
  useFactory: createPaymentProvider,
  inject: [ConfigService],
};
