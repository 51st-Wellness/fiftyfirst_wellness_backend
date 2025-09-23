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
  // Gmail email sender provider
  private readonly OAuth2Client: OAuth2Client;
  private readonly transporter?: Transporter;
  private readonly logger: Logger;

  private readonly gmailClientId: string;
  private readonly gmailClientSecret: string;
  private readonly gmailRefreshToken: string;
  private readonly companyEmail: string;
  private readonly companyName: string;
  private readonly gmailRedirectUri: string =
    'https://developers.google.com/oauthplayground';
  private readonly gmailTransport: 'api' | 'smtp';

  constructor(private readonly configService: ConfigService) {
    // Initialize provider config and auth
    this.logger = new Logger(GmailProvider.name);

    // Get configuration values with error handling
    this.gmailClientId = this.configService.get(ENV.GMAIL_CLIENT_ID);
    this.gmailClientSecret = this.configService.get(ENV.GMAIL_CLIENT_SECRET);
    this.gmailRefreshToken = this.configService.get(ENV.GMAIL_REFRESH_TOKEN);
    this.companyEmail = this.configService.get(ENV.COMPANY_EMAIL);
    this.companyName = this.configService.get(ENV.COMPANY_NAME);
    this.gmailTransport =
      (this.configService.get(ENV.GMAIL_TRANSPORT) as 'api' | 'smtp') || 'api';

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

      // Initialize nodemailer transporter (only if SMTP is selected)
      if (this.gmailTransport === 'smtp') {
        this.transporter = createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: this.companyEmail,
            clientId: this.gmailClientId,
            clientSecret: this.gmailClientSecret,
            refreshToken: this.gmailRefreshToken,
          },
          // Optional: increase timeouts if needed
          // connectionTimeout: 20000,
          // greetingTimeout: 10000,
          // socketTimeout: 20000,
        } as unknown as SMTPPool);
      }

      this.logger.log(
        `Gmail provider initialized (${this.gmailTransport.toUpperCase()})`,
      );
    } catch (error) {
      this.logger.error('Error initializing Gmail provider:', error);
    }
  }

  // Send an email using Gmail API or SMTP depending on configuration
  public async sendMail(renderedEmail: RenderedEmailDto): Promise<boolean> {
    try {
      if (this.gmailTransport === 'api') {
        await this.sendViaGmailApi(renderedEmail); // Use Gmail REST API (HTTPS)
      } else {
        await this.sendViaSmtp(renderedEmail); // Use SMTP (fallback)
      }

      this.logger.log(
        `Email sent successfully to ${renderedEmail.to} via Gmail (${this.gmailTransport.toUpperCase()})`,
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

  // Build RFC 2822 message and send with Gmail REST API
  private async sendViaGmailApi(
    renderedEmail: RenderedEmailDto,
  ): Promise<void> {
    // Send using Gmail API
    const gmail = google.gmail({ version: 'v1', auth: this.OAuth2Client }); // Create Gmail client

    // Build raw MIME message
    const mime = [
      `From: "${this.companyName || 'Fifty First Wellness'}" <${this.companyEmail}>`,
      `To: ${renderedEmail.to}`,
      `Subject: ${this.encodeHeader(renderedEmail.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      renderedEmail.htmlContent,
    ].join('\n'); // Construct MIME message

    const encodedMessage = this.base64UrlEncode(Buffer.from(mime)); // Encode to base64url

    // Ensure we have a fresh access token before sending
    await this.OAuth2Client.getAccessToken(); // Refresh access token if needed

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    }); // Call Gmail API
  }

  // SMTP fallback using Nodemailer
  private async sendViaSmtp(renderedEmail: RenderedEmailDto): Promise<void> {
    // Send using SMTP
    if (!this.transporter) throw new Error('SMTP transporter not initialized');

    await new Promise<void>((resolve, reject) => {
      this.transporter!.sendMail(
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
          if (err) return reject(err); // Propagate error
          resolve();
        },
      );
    });
  }

  // Encode Subject header safely (handles non-ASCII)
  private encodeHeader(value: string): string {
    // Encode header value
    // Simple Q-encoding for UTF-8 subjects
    const base64 = Buffer.from(value, 'utf8').toString('base64');
    return `=?UTF-8?B?${base64}?=`;
  }

  // Convert buffer to base64url (Gmail API requires URL-safe base64)
  private base64UrlEncode(buf: Buffer): string {
    // Base64url encode
    return buf
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
}
