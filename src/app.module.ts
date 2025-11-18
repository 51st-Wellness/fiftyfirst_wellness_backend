import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { databaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CommonModule } from './common/common.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ProductModule } from './modules/product/product.module';
import { AppCacheModule } from './util/cache/cache.module';
import { PodcastModule } from './modules/podcast/podcast.module';
import { StatsModule } from './modules/stats/stats.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ReviewModule } from './modules/review/review.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    AppCacheModule,
    DatabaseModule,
    CommonModule,
    NotificationModule,
    UserModule,
    AuthModule,
    ProductModule,
    PaymentModule,
    PodcastModule,
    StatsModule,
    SubscriptionModule,
    SettingsModule,
    ReviewModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
