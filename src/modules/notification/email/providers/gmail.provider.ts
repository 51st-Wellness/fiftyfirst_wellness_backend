import { createTransport, Transporter } from 'nodemailer';
import { Injectable, Logger } from '@nestjs/common';
import { EmailSenderProvider } from './email-sender.interface';
import { RenderedEmailDto } from '../dto/rendered-email.dto';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';

@Injectable()
export default class GmailProvider implements EmailSenderProvider {
  // Gmail email sender provider using App Password authentication
  private readonly transporter: Transporter;
  private readonly logger: Logger;

  private readonly gmailEmail: string;
  private readonly gmailAppPassword: string;
  private readonly companyEmail: string;
  private readonly companyName: string;

  constructor(private readonly configService: ConfigService) {
    // Initialize provider config
    this.logger = new Logger(GmailProvider.name);

    // Get configuration values with error handling
    this.gmailEmail = this.configService.get(ENV.GMAIL_EMAIL);
    this.gmailAppPassword = this.configService.get(ENV.GMAIL_APP_PASSWORD);
    this.companyEmail = this.configService.get(ENV.COMPANY_EMAIL);
    this.companyName = this.configService.get(ENV.COMPANY_NAME);

    try {
      // Initialize nodemailer transporter with App Password
      this.transporter = createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: this.gmailEmail,
          pass: this.gmailAppPassword, // Use App Password, not regular password
        },
        // Connection timeout settings
        connectionTimeout: 20000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });

      this.logger.log(
        'Gmail provider initialized with App Password authentication',
      );
    } catch (error) {
      this.logger.error('Error initializing Gmail provider:', error);
      throw error;
    }
  }

  // Send an email using Gmail SMTP with App Password
  public async sendMail(renderedEmail: RenderedEmailDto): Promise<boolean> {
    try {
      await this.sendViaSmtp(renderedEmail);

      this.logger.log(
        `Email sent successfully to ${renderedEmail.to} via Gmail SMTP`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        'Error sending email via Gmail:' + '\n' + error?.message,
      );
      console.error(error);
      throw error;
    }
  }

  // Send email using SMTP with App Password authentication
  private async sendViaSmtp(renderedEmail: RenderedEmailDto): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.transporter.sendMail(
        {
          from: {
            name: this.companyName || 'Fifty Firsts Wellness',
            address: this.companyEmail,
          },
          to: renderedEmail.to,
          subject: renderedEmail.subject,
          html: renderedEmail.htmlContent,
          text: renderedEmail.plainText,
        },
        (err) => {
          if (err) return reject(err);
          resolve();
        },
      );
    });
  }
}
