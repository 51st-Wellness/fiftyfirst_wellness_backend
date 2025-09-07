import { Module } from '@nestjs/common';
import { SubscriptionModule } from './submodules/subscriptions/subscription.module';

@Module({
  imports: [SubscriptionModule],
  exports: [SubscriptionModule],
})
export class PaymentModule {}
