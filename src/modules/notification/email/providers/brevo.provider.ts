import { Logger } from '@nestjs/common';
import { EmailSenderProvider } from './email-sender.interface';
import { RenderedEmailDto } from '../dto/rendered-email.dto';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';

export default class BrevoProvider implements EmailSenderProvider {
  private readonly logger: Logger;
  private readonly apiKey: string;
  private readonly senderEmail: string;
  private readonly companyName: string;
  private readonly apiUrl: string = 'https://api.brevo.com/v3/smtp/email';

  constructor(
    logger: Logger,
    private readonly configService: ConfigService,
  ) {
    this.logger = logger;
    this.apiKey = this.configService.get(ENV.BREVO_API_KEY);
    this.senderEmail = this.configService.get(ENV.BREVO_SENDER_EMAIL);
    this.companyName = this.configService.get(ENV.COMPANY_NAME);
  }

  public async sendMail(renderedEmail: RenderedEmailDto): Promise<boolean> {
    try {
      // Prepare the email payload for Brevo API
      const brevoPayload = {
        sender: {
          name: this.companyName,
          email: this.senderEmail,
        },
        to: [
          {
            email: renderedEmail.to,
          },
        ],
        subject: renderedEmail.subject,
        htmlContent: renderedEmail.htmlContent,
      };

      // Send email via Brevo API
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify(brevoPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        this.logger.error('Brevo API error:', errorData);
        throw new Error(
          `Brevo API error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log('Email sent successfully via Brevo:', result);
      return true;
    } catch (error) {
      this.logger.error('Error sending email via Brevo:', error);
      throw error;
    }
  }
}
