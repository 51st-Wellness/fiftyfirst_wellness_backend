import { Logger } from '@nestjs/common';
import { EmailSenderProvider } from './email-sender.interface';
import { RenderedEmailDto } from '../dto/rendered-email.dto';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';

export default class MailerooProvider implements EmailSenderProvider {
  private readonly logger: Logger;
  private readonly apiKey: string;
  private readonly senderEmail: string;
  private readonly companyName: string;
  private readonly apiUrl: string = 'https://smtp.maileroo.com/api/v2/emails';

  constructor(
    private readonly configService: ConfigService,
    logger: Logger,
  ) {
    this.logger = logger;

    // Get configuration values with error handling
    this.apiKey = this.configService.get(ENV.MAILEROO_API_KEY);
    this.senderEmail = this.configService.get(ENV.MAILEROO_SENDER_EMAIL);
    this.companyName = this.configService.get(ENV.COMPANY_NAME);
  }

  public async sendMail(renderedEmail: RenderedEmailDto): Promise<boolean> {
    try {
      // Prepare the email payload for Maileroo API
      const mailerooPayload = {
        from: {
          address: this.senderEmail,
          display_name: this.companyName,
        },
        to: [
          {
            address: renderedEmail.to,
          },
        ],
        subject: renderedEmail.subject,
        html: renderedEmail.htmlContent,
        plain_text: renderedEmail.htmlContent,
      };

      // Send email via Maileroo API
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(mailerooPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error('Maileroo API error:', errorData);
        throw new Error(
          `Maileroo API error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log('Email sent successfully via Maileroo:', result);
      return true;
    } catch (error) {
      this.logger.error(
        'Error sending email via Maileroo:' + '\n' + error.message,
      );
      console.error(error);
      throw error;
    }
  }
}
