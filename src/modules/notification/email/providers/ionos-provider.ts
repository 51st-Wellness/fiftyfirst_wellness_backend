// src/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailSenderProvider } from './email-sender.interface';
import { RenderedEmailDto } from 'src/modules/notification/email/dto/rendered-email.dto';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';

@Injectable()
export default class IONOSProvider implements EmailSenderProvider {
  constructor(
    private readonly logger: Logger,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendMail(renderedEmail: RenderedEmailDto): Promise<boolean> {
    await this.mailerService.sendMail({
      to: renderedEmail.to,
      from: this.configService.get(ENV.IONOS_SMTP_FROM_EMAIL), // Optional: override default 'from'
      subject: renderedEmail.subject,
      html: renderedEmail.htmlContent,
    });
    return true;
  }
}
