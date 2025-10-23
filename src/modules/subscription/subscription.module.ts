import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { MailerooModule } from '../maileroo/maileroo.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [MailerooModule, NotificationModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
