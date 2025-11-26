import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionModule } from './submodules/subscriptions/subscription.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { DatabaseModule } from 'src/database/database.module';
import { ConfigModule } from 'src/config/config.module';
import { PaymentProviderBinding } from './providers/payment.factory';
import { SettingsModule } from 'src/modules/settings/settings.module';
import { ShippingModule } from 'src/modules/shipping/shipping.module';
import { UserModule } from '@/modules/user/user.module';

@Module({
  imports: [
    forwardRef(() => SubscriptionModule),
    forwardRef(() => UserModule),
    DatabaseModule,
    ConfigModule,
    SettingsModule,
    ShippingModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentProviderBinding],
  exports: [PaymentService, SubscriptionModule],
})
export class PaymentModule {}
