import { Injectable, Logger } from '@nestjs/common';
import MailerooProvider from './providers/maileroo.provider';
import { EmailPayloadDto } from './dto/email-payload.dto';
import * as ejs from 'ejs';
import * as path from 'path';
import { EmailBaseConfig } from './config/email-base.config';
import { EmailSubjects } from './config/email-subjects.config';
import { EmailTemplates } from './config/email-templates.config';
import { EmailSenderProvider } from './providers/email-sender.interface';
import { ConfigService } from 'src/config/config.service';

export interface RenderedEmail {
  to: string;
  subject: string;
  htmlContent: string;
}
@Injectable()
export class EmailService {
  private readonly logger: Logger = new Logger(EmailService.name);
  private providers: EmailSenderProvider[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly mailerooProvider: MailerooProvider,
  ) {
    // Primary provider is Maileroo (API-based), with Resend and Gmail as fallbacks
    this.providers = [this.mailerooProvider];
  }

  async sendMail(emailPayload: EmailPayloadDto): Promise<boolean> {
    try {
      // Render the email using the render service
      const renderedEmail = await EmailService.renderEmail(emailPayload);

      // Try each provider until one succeeds
      for (const provider of this.providers) {
        try {
          let sent = await provider.sendMail(renderedEmail);
          this.logger.log(
            `Email sent successfully to ${emailPayload.to} via ${provider.constructor.name}`,
          );
          if (sent === true) return true;
          if (!sent) {
            throw new Error(
              `Email not sent to ${emailPayload.to} via ${provider.constructor.name}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error sending email to ${emailPayload.to} with ${provider.constructor.name}` +
              '\n' +
              error.message,
          );
        }
      }

      // If no provider succeeded
      this.logger.error(
        `All providers failed to send email to ${emailPayload.to} with type ${emailPayload.type}`,
      );
      return false;
    } catch (error) {
      this.logger.error('Error in email service:', error);
      return false;
    }
  }

  /**
   * Renders an email using EJS template and email configuration
   */
  static async renderEmail(
    emailPayload: EmailPayloadDto,
  ): Promise<RenderedEmail> {
    try {
      // Get subject from configuration
      const subject = EmailSubjects[emailPayload.type];
      emailPayload.context = {
        ...emailPayload.context,
        ...EmailBaseConfig,
      };
      // Get template path from configuration
      let templateFile = EmailTemplates[emailPayload.type];

      // No dynamic template selection needed - templates are now role-specific

      if (!templateFile) {
        throw new Error(
          `No template configured for email type: ${emailPayload.type}`,
        );
      }

      // Render the HTML content - templates are now in root view/emails folder
      const templatePath = path.resolve(
        process.cwd(),
        'view/emails',
        templateFile,
      );
      const htmlContent = await EmailService.renderTemplate(
        templatePath,
        emailPayload.context,
      );

      return {
        to: emailPayload.to,
        subject,
        htmlContent,
      };
    } catch (error) {
      console.error('Error rendering email:', error);
      throw error;
    }
  }

  /**
   * Helper method to render EJS templates
   */
  private static renderTemplate(
    templatePath: string,
    data: Record<string, any>,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      ejs.renderFile(templatePath, data, (error, html) => {
        if (error) {
          console.error('Error rendering email template:', error);
          reject(error);
          return;
        }
        resolve(html);
      });
    });
  }
}
