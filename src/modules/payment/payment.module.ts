import { Module } from '@nestjs/common';
import { SubscriptionModule } from './submodules/subscriptions/subscription.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConfigModule } from 'src/config/config.module';
import { PaymentProviderBinding } from './providers/payment.factory';
import { UserModule } from 'src/modules/user/user.module';

@Module({
  imports: [SubscriptionModule, PrismaModule, ConfigModule, UserModule],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentProviderBinding],
  exports: [PaymentService, SubscriptionModule],
})
export class PaymentModule {}
