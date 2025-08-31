import { Module } from '@nestjs/common';
import { EmailService } from './email/email.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule } from 'src/config/config.module';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import BrevoProvider from './email/providers/brevo.provider';
import IONOSProvider from './email/providers/ionos-provider';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get(ENV.IONOS_SMTP_HOST),
          port: config.get(ENV.IONOS_SMTP_PORT),
          auth: {
            user: config.get(ENV.IONOS_SMTP_USERNAME),
            pass: config.get(ENV.IONOS_SMTP_PASSWORD),
          },
        },
      }),
    }),
  ],
  providers: [EmailService, BrevoProvider, IONOSProvider],
  exports: [EmailService],
})
export class NotificationModule {}
