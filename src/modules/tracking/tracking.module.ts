import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TrackingProcessor } from './tracking.processor';
import { RoyalMailService } from './royal-mail/royal-mail.service';
import { QUEUE_NAMES } from 'src/config/queues.config';
import { DatabaseModule } from 'src/database/database.module';
import { CommonModule } from 'src/common/common.module';
import { ENV } from 'src/config/env.enum';
import { UserModule } from '@/modules/user/user.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get(ENV.REDIS_URL);

        if (!redisUrl) {
          throw new Error('REDIS_URL is required for BullMQ');
        }

        // Parse Redis URL
        let connection: any;
        if (
          redisUrl.startsWith('redis://') ||
          redisUrl.startsWith('rediss://')
        ) {
          const url = new URL(redisUrl);
          connection = {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            password: url.password || undefined,
            ...(redisUrl.startsWith('rediss://') && { tls: {} }),
          };
        } else {
          // Fallback for simple host:port format
          const [host, port] = redisUrl.split(':');
          connection = {
            host: host || 'localhost',
            port: parseInt(port || '6379', 10),
          };
        }

        return {
          connection,
          defaultJobOptions: {
            removeOnComplete: {
              age: 24 * 3600,
              count: 1000,
            },
            removeOnFail: {
              age: 7 * 24 * 3600,
            },
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.TRACKING,
    }),
    UserModule,
  ],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingProcessor, RoyalMailService],
  exports: [TrackingService],
})
export class TrackingModule {}
