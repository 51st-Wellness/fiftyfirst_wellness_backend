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
    private readonly configService: ConfigService,
    logger: Logger,
  ) {
    this.logger = logger;

    // Get configuration values with error handling
    this.apiKey = this.configService.get(ENV.BREVO_API_KEY);
    this.senderEmail = this.configService.get(ENV.BREVO_SENDER_EMAIL);
    this.companyName = this.configService.get(ENV.COMPANY_NAME);

    // Validate required configuration
    if (!this.apiKey) {
      this.logger.warn(
        'BREVO_API_KEY is not configured. Brevo email provider will not work.',
      );
    }
    if (!this.senderEmail) {
      this.logger.warn(
        'BREVO_SENDER_EMAIL is not configured. Brevo email provider will not work.',
      );
    }
    if (!this.companyName) {
      this.logger.warn(
        'COMPANY_NAME is not configured. Using default company name.',
      );
      this.companyName = 'Fifty Firsts Wellness';
    }
  }

  public async sendMail(renderedEmail: RenderedEmailDto): Promise<boolean> {
    try {
      // Check if required configuration is available
      if (!this.apiKey || !this.senderEmail) {
        this.logger.error(
          'Brevo configuration is incomplete. Cannot send email.',
        );
        return false;
      }

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
        textContent: renderedEmail.plainText,
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
      this.logger.error(
        'Error sending email via Brevo:' + '\n' + error.message,
      );
      console.error(error);
      throw error;
    }
  }
}
