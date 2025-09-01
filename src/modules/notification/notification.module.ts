import { Module } from '@nestjs/common';
import { EmailService } from './email/email.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule } from 'src/config/config.module';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import BrevoProvider from './email/providers/brevo.provider';
import IONOSProvider from './email/providers/ionos-provider';
import { Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Module({
  imports: [
    ConfigModule,
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
  providers: [
    EmailService,
    {
      provide: BrevoProvider,
      useFactory: (configService: ConfigService) => {
        return new BrevoProvider(configService, new Logger(BrevoProvider.name));
      },
      inject: [ConfigService],
    },
    {
      provide: IONOSProvider,
      useFactory: (
        configService: ConfigService,
        mailerService: MailerService,
      ) => {
        return new IONOSProvider(
          new Logger(IONOSProvider.name),
          mailerService,
          configService,
        );
      },
      inject: [ConfigService, MailerService],
    },
  ],
  exports: [EmailService],
})
export class NotificationModule {}
