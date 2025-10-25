import { Injectable, Logger } from '@nestjs/common';
import { MailerooService } from '../maileroo/maileroo.service';
import { EmailService } from '../notification/email/email.service';
import { EmailType } from '../notification/email/constants/email.enum';
import { NewsletterSubscriptionDto } from './dto/newsletter-subscription.dto';
import { WaitlistSubscriptionDto } from './dto/waitlist-subscription.dto';
import { ContactFormDto } from './dto/contact-form.dto';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly mailerooService: MailerooService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Subscribe user to newsletter
   */
  async subscribeToNewsletter(
    subscriptionData: NewsletterSubscriptionDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Add to Maileroo newsletter list
      await this.mailerooService.addToNewsletter(
        subscriptionData.email,
        subscriptionData.name,
      );

      // Send welcome email
      await this.emailService.sendMail({
        to: subscriptionData.email,
        type: EmailType.NEWSLETTER_SUBSCRIPTION,
        context: {
          firstName:
            subscriptionData.name || subscriptionData.email.split('@')[0],
          email: subscriptionData.email,
        },
      });

      this.logger.log(
        `Newsletter subscription successful for: ${subscriptionData.email}`,
      );

      return {
        success: true,
        message:
          'Successfully subscribed to newsletter! Check your email for confirmation.',
      };
    } catch (error) {
      this.logger.error(
        `Newsletter subscription failed for ${subscriptionData.email}:`,
        error.message,
      );

      // Return user-friendly error message
      if (
        error.message.includes('already exists') ||
        error.message.includes('duplicate')
      ) {
        return {
          success: false,
          message: 'You are already subscribed to our newsletter.',
        };
      }

      return {
        success: false,
        message: 'Failed to subscribe to newsletter. Please try again later.',
      };
    }
  }

  /**
   * Subscribe user to waitlist
   */
  async subscribeToWaitlist(
    subscriptionData: WaitlistSubscriptionDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Add to Maileroo waitlist
      await this.mailerooService.addToWaitlist(
        subscriptionData.email,
        subscriptionData.name,
      );

      // Send welcome email for waitlist
      await this.emailService.sendMail({
        to: subscriptionData.email,
        type: EmailType.WAITLIST_SUBSCRIPTION,
        context: {
          firstName:
            subscriptionData.name || subscriptionData.email.split('@')[0],
          email: subscriptionData.email,
        },
      });

      this.logger.log(
        `Waitlist subscription successful for: ${subscriptionData.email}`,
      );

      return {
        success: true,
        message:
          "Successfully joined the waitlist! We'll notify you when we launch.",
      };
    } catch (error) {
      this.logger.error(
        `Waitlist subscription failed for ${subscriptionData.email}:`,
        error.message,
      );

      // Return user-friendly error message
      if (
        error.message.includes('already exists') ||
        error.message.includes('duplicate')
      ) {
        return {
          success: false,
          message: 'You are already on our waitlist.',
        };
      }

      return {
        success: false,
        message: 'Failed to join waitlist. Please try again later.',
      };
    }
  }

  /**
   * Unsubscribe user from newsletter
   */
  async unsubscribeFromNewsletter(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.mailerooService.removeFromNewsletter(email);

      this.logger.log(`Newsletter unsubscription successful for: ${email}`);

      return {
        success: true,
        message: 'Successfully unsubscribed from newsletter.',
      };
    } catch (error) {
      this.logger.error(
        `Newsletter unsubscription failed for ${email}:`,
        error.message,
      );

      return {
        success: false,
        message: 'Failed to unsubscribe. Please try again later.',
      };
    }
  }

  /**
   * Remove user from waitlist
   */
  async removeFromWaitlist(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.mailerooService.removeFromWaitlist(email);

      this.logger.log(`Waitlist removal successful for: ${email}`);

      return {
        success: true,
        message: 'Successfully removed from waitlist.',
      };
    } catch (error) {
      this.logger.error(`Waitlist removal failed for ${email}:`, error.message);

      return {
        success: false,
        message: 'Failed to remove from waitlist. Please try again later.',
      };
    }
  }

  /**
   * Submit contact form and send email to support
   */
  async submitContactForm(
    contactData: ContactFormDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const supportEmail = this.configService.get(ENV.SUPPORT_EMAIL);

      if (!supportEmail) {
        this.logger.error('Support email not configured');
        return {
          success: false,
          message: 'Contact form submission failed. Please try again later.',
        };
      }

      // Send email to support team
      await this.emailService.sendMail({
        to: supportEmail,
        type: EmailType.CONTACT_FORM_SUBMISSION,
        context: {
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          email: contactData.email,
          message: contactData.message,
          fullName: `${contactData.firstName} ${contactData.lastName}`,
        },
      });

      this.logger.log(
        `Contact form submission successful from: ${contactData.email}`,
      );

      return {
        success: true,
        message:
          "Your message has been sent successfully! We'll get back to you soon.",
      };
    } catch (error) {
      this.logger.error(
        `Contact form submission failed from ${contactData.email}:`,
        error.message,
      );

      return {
        success: false,
        message: 'Failed to send message. Please try again later.',
      };
    }
  }
}
