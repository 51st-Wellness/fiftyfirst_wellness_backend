import { Module } from '@nestjs/common';
import { EmailService } from './email/email.service';
import { ConfigModule } from 'src/config/config.module';
import { ConfigService } from 'src/config/config.service';
import BrevoProvider from './email/providers/brevo.provider';
import GmailProvider from './email/providers/gmail.provider';
import ResendProvider from './email/providers/resend.provider';
import MailerooProvider from './email/providers/maileroo.provider';
import { Logger } from '@nestjs/common';

@Module({
  imports: [ConfigModule],
  providers: [
    EmailService,
    {
      provide: MailerooProvider,
      useFactory: (configService: ConfigService) => {
        return new MailerooProvider(
          configService,
          new Logger(MailerooProvider.name),
        );
      },
      inject: [ConfigService],
    },
    {
      provide: ResendProvider,
      useFactory: (configService: ConfigService) => {
        return new ResendProvider(
          configService,
          new Logger(ResendProvider.name),
        );
      },
      inject: [ConfigService],
    },
    {
      provide: BrevoProvider,
      useFactory: (configService: ConfigService) => {
        return new BrevoProvider(configService, new Logger(BrevoProvider.name));
      },
      inject: [ConfigService],
    },
    {
      provide: GmailProvider,
      useFactory: (configService: ConfigService) => {
        return new GmailProvider(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [EmailService],
})
export class NotificationModule {}
