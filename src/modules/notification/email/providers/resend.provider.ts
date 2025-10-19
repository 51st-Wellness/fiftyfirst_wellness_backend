import { Logger } from '@nestjs/common';
import { EmailSenderProvider } from './email-sender.interface';
import { RenderedEmailDto } from '../dto/rendered-email.dto';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';

/**
 * Resend email provider implementation
 * Uses the Resend HTTP API to send emails
 */
export default class ResendProvider implements EmailSenderProvider {
  private readonly logger: Logger;
  private readonly apiKey: string;
  private readonly senderEmail: string;
  private readonly companyName: string;
  private readonly apiUrl: string = 'https://api.resend.com/emails';

  constructor(
    private readonly configService: ConfigService,
    logger: Logger,
  ) {
    this.logger = logger;

    // Get configuration values with error handling
    this.apiKey = this.configService.get(ENV.RESEND_API_KEY);
    this.senderEmail = this.configService.get(ENV.RESEND_SENDER_EMAIL);
    this.companyName = this.configService.get(ENV.COMPANY_NAME);
  }

  // Send email using Resend API
  public async sendMail(renderedEmail: RenderedEmailDto): Promise<boolean> {
    try {
      // Check if required configuration is available
      if (!this.apiKey || !this.senderEmail) {
        this.logger.error(
          'Resend configuration is incomplete. Cannot send email.',
        );
        return false;
      }

      const fromHeader = this.companyName
        ? `${this.companyName} <${this.senderEmail}>`
        : this.senderEmail;

      const payload = {
        from: fromHeader,
        to: [renderedEmail.to],
        subject: renderedEmail.subject,
        html: renderedEmail.htmlContent,
      } as const;

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorText: string;
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = `${response.status} ${response.statusText}`;
        }
        this.logger.error('Resend API error:', errorText);
        throw new Error(
          `Resend API error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(
        `Email sent successfully via Resend to ${renderedEmail.to}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        'Error sending email via Resend:',
        (error as any)?.message || error,
      );
      throw error;
    }
  }
}
