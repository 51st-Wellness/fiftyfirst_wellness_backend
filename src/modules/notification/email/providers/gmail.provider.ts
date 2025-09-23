import { google } from 'googleapis';
import { createTransport, Transporter } from 'nodemailer';
import SMTPPool from 'nodemailer/lib/smtp-pool';
import { Injectable, Logger } from '@nestjs/common';
import { EmailSenderProvider } from './email-sender.interface';
import { RenderedEmailDto } from '../dto/rendered-email.dto';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';

class OAuth2Client extends google.auth.OAuth2 {}

@Injectable()
export default class GmailProvider implements EmailSenderProvider {
  private readonly OAuth2Client: OAuth2Client;
  private readonly transporter: Transporter;
  private readonly logger: Logger;

  private readonly gmailClientId: string;
  private readonly gmailClientSecret: string;
  private readonly gmailRefreshToken: string;
  private readonly companyEmail: string;
  private readonly companyName: string;
  private readonly gmailRedirectUri: string =
    'https://developers.google.com/oauthplayground';

  constructor(private readonly configService: ConfigService) {
    this.logger = new Logger(GmailProvider.name);

    // Get configuration values with error handling
    this.gmailClientId = this.configService.get(ENV.GMAIL_CLIENT_ID);
    this.gmailClientSecret = this.configService.get(ENV.GMAIL_CLIENT_SECRET);
    this.gmailRefreshToken = this.configService.get(ENV.GMAIL_REFRESH_TOKEN);
    this.companyEmail = this.configService.get(ENV.COMPANY_EMAIL);
    this.companyName = this.configService.get(ENV.COMPANY_NAME);

    try {
      // Initialize OAuth2 client
      this.OAuth2Client = new google.auth.OAuth2(
        this.gmailClientId,
        this.gmailClientSecret,
        this.gmailRedirectUri,
      );

      this.OAuth2Client.setCredentials({
        refresh_token: this.gmailRefreshToken,
      });

      // Initialize nodemailer transporter
      this.transporter = createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: this.companyEmail,
          clientId: this.gmailClientId,
          clientSecret: this.gmailClientSecret,
          refreshToken: this.gmailRefreshToken,
        },
      } as unknown as SMTPPool);

      this.logger.log('Gmail provider initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing Gmail provider:', error);
    }
  }

  public async sendMail(renderedEmail: RenderedEmailDto): Promise<boolean> {
    try {
      // Get fresh access token
      (this.transporter as any).accessToken =
        (await this.OAuth2Client.getAccessToken()) as any;

      // Send email using nodemailer
      await new Promise<void>((resolve, reject) => {
        this.transporter.sendMail(
          {
            from: {
              name: this.companyName || 'Fifty First Wellness',
              address: this.companyEmail,
            },
            to: renderedEmail.to,
            subject: renderedEmail.subject,
            html: renderedEmail.htmlContent,
          },
          (err) => {
            if (err) {
              this.logger.error('Error sending email via Gmail', err);
              reject(err);
              return;
            }
            resolve();
          },
        );
      });

      this.logger.log(
        `Email sent successfully to ${renderedEmail.to} via Gmail`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        'Error sending email via Gmail:' + '\n' + error.message,
      );
      console.error(error);
      throw error;
    }
  }
}
