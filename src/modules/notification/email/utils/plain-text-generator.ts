import { EmailType } from '../constants/email.enum';
import { EmailBaseConfig } from '../config/email-base.config';

/**
 * Generates plain text version of emails based on email type and context
 * This improves email deliverability by providing both HTML and plain text versions
 */
export class PlainTextGenerator {
  /**
   * Generate plain text content for any email type
   */
  static generatePlainText(
    emailType: EmailType,
    context: Record<string, any>,
  ): string {
    const baseContext = {
      ...context,
      ...EmailBaseConfig,
    };

    switch (emailType) {
      // Welcome emails
      case EmailType.WELCOME_USER:
        return this.generateWelcomeUserPlainText(baseContext);
      case EmailType.WELCOME_ADMIN:
        return this.generateWelcomeAdminPlainText(baseContext);

      // Authentication emails
      case EmailType.PASSWORD_RESET:
        return this.generatePasswordResetPlainText(baseContext);
      case EmailType.EMAIL_VERIFICATION:
        return this.generateEmailVerificationPlainText(baseContext);
      case EmailType.EMAIL_VERIFICATION_SUCCESS:
        return this.generateEmailVerificationSuccessPlainText(baseContext);
      case EmailType.LOGIN_REMINDER:
        return this.generateLoginReminderPlainText(baseContext);
      case EmailType.ACCOUNT_ACTIVATION:
        return this.generateAccountActivationPlainText(baseContext);

      // Account management emails
      case EmailType.ACCOUNT_DEACTIVATION:
        return this.generateAccountDeactivationPlainText(baseContext);

      // Newsletter and marketing emails
      case EmailType.NEWSLETTER_SUBSCRIPTION:
        return this.generateNewsletterSubscriptionPlainText(baseContext);

      // Subscription emails
      case EmailType.SUBSCRIPTION_RENEWAL:
        return this.generateSubscriptionRenewalPlainText(baseContext);

      default:
        return this.generateDefaultPlainText(baseContext);
    }
  }

  // Welcome emails
  private static generateWelcomeUserPlainText(context: any): string {
    return `
Welcome to Fifty Firsts Wellness!

Dear ${context.firstName || 'Valued Member'},

Welcome to your journey of midlife transformation! Your account is now active and ready to use.

What you can expect:
- Personalized wellness programs
- Expert guidance and support
- Community features and resources

Log in to your dashboard to explore all available features.

Welcome aboard!

Best regards,
The Fifty Firsts Wellness Team

---
Contact us at ${context.companyEmail || 'support@fiftyfirstswellness.com'}.
    `.trim();
  }

  private static generateWelcomeAdminPlainText(context: any): string {
    return `
Welcome to the Fifty Firsts Wellness Team!

Dear ${context.firstName || 'Team Member'},

Welcome to the Fifty Firsts Wellness team! We're excited to have you join us in our mission to transform lives.

Your role includes:
- Admin dashboard access
- User and content management
- Collaboration with our team

Please review team guidelines in your admin dashboard. Contact your supervisor with any questions.

We're looking forward to working with you!

Best regards,
The Fifty Firsts Wellness Leadership Team

---
For team questions, contact us at ${context.companyEmail || 'admin@fiftyfirstswellness.com'}.
    `.trim();
  }

  // Authentication emails
  private static generatePasswordResetPlainText(context: any): string {
    return `
Reset Your Password - Fifty Firsts Wellness

Dear ${context.firstName || 'User'},

We received a request to reset your password for your Fifty Firsts Wellness account.

Click the link below to reset your password:
${context.resetLink || 'https://fiftyfirstswellness.com/reset-password'}

This link expires in 24 hours.

If you didn't request this password reset, please ignore this email.

Best regards,
The Fifty Firsts Wellness Team

---
Contact us at ${context.companyEmail || 'support@fiftyfirstswellness.com'} if you didn't request this.
    `.trim();
  }

  private static generateEmailVerificationPlainText(context: any): string {
    return `
Verify Your Email - Complete Your Registration

Dear ${context.firstName || 'User'},

Thank you for signing up with Fifty Firsts Wellness! To complete your registration, please verify your email address.

Click the link below to verify your email:
${context.verificationLink || 'https://fiftyfirstswellness.com/verify-email'}

This link expires in 24 hours.

Once verified, you'll have access to your personalized wellness dashboard and all resources.

If you didn't create this account, please ignore this email.

Best regards,
The Fifty Firsts Wellness Team

---
Contact us at ${context.companyEmail || 'support@fiftyfirstswellness.com'} if you didn't create this account.
    `.trim();
  }

  private static generateEmailVerificationSuccessPlainText(
    context: any,
  ): string {
    return `
Email Verified Successfully - Welcome to Fifty Firsts Wellness!

Dear ${context.firstName || 'User'},

Congratulations! Your email has been successfully verified and your account is now fully activated.

You now have access to:
- Complete wellness programs and resources
- Personalized dashboard and progress tracking
- Community features and support

Your journey to midlife transformation begins now! Log in to your account to explore all features.

Best regards,
The Fifty Firsts Wellness Team

---
Contact us at ${context.companyEmail || 'support@fiftyfirstswellness.com'} for assistance.
    `.trim();
  }

  private static generateLoginReminderPlainText(context: any): string {
    return `
Welcome Back to Fifty Firsts Wellness!

Dear ${context.firstName || 'Valued Member'},

We noticed you haven't logged in to your Fifty Firsts Wellness account recently. We miss you!

Your account is still active and waiting for you. Log in to:
- Continue your personalized wellness programs
- Access new resources and content
- Connect with our community
- Track your progress

Don't let your wellness journey pause - every step forward matters!

Log in now: ${context.loginLink || 'https://fiftyfirstswellness.com/login'}

Best regards,
The Fifty Firsts Wellness Team

---
Contact us at ${context.companyEmail || 'support@fiftyfirstswellness.com'} for assistance.
    `.trim();
  }

  private static generateAccountActivationPlainText(context: any): string {
    return `
Activate Your Fifty Firsts Wellness Account

Dear ${context.firstName || 'User'},

Your Fifty Firsts Wellness account is ready for activation! Complete your account setup to start your wellness journey.

Click the link below to activate your account:
${context.activationLink || 'https://fiftyfirstswellness.com/activate-account'}

Once activated, you'll have access to:
- Personalized wellness programs
- Expert guidance and resources
- Community features and support

This activation link expires in 24 hours.

If you didn't create this account, please ignore this email.

Best regards,
The Fifty Firsts Wellness Team

---
Contact us at ${context.companyEmail || 'support@fiftyfirstswellness.com'} if you didn't create this account.
    `.trim();
  }

  // Account management emails
  private static generateAccountDeactivationPlainText(context: any): string {
    return `
Account Deactivation Confirmation - Fifty Firsts Wellness

Dear ${context.firstName || 'User'},

Your Fifty Firsts Wellness account has been successfully deactivated.

Account Status:
- Your account is now deactivated
- Your data has been securely stored
- You can reactivate your account at any time

If you change your mind, you can reactivate your account by logging in with your existing credentials.

We're sorry to see you go, but we understand that everyone's wellness journey is unique.

If you ever want to return to our community, we'll be here to welcome you back!

Best regards,
The Fifty Firsts Wellness Team

---
Contact us at ${context.companyEmail || 'support@fiftyfirstswellness.com'} for assistance.
    `.trim();
  }

  // Newsletter and marketing emails
  private static generateNewsletterSubscriptionPlainText(context: any): string {
    return `
Welcome to Our Newsletter - Stay Inspired & Informed!

Dear ${context.firstName || 'Newsletter Subscriber'},

Thank you for subscribing to the Fifty Firsts Wellness newsletter! You'll now receive:

- Weekly wellness tips and insights
- Exclusive content and resources
- Community updates and success stories
- Special offers and promotions

Your first newsletter will arrive in your inbox soon!

If you ever want to unsubscribe or update your preferences, you can do so at any time using the links in our emails.

Welcome to our community of wellness enthusiasts!

Best regards,
The Fifty Firsts Wellness Team

---
Contact us at ${context.companyEmail || 'support@fiftyfirstswellness.com'} for assistance.
    `.trim();
  }

  // Subscription emails
  private static generateSubscriptionRenewalPlainText(context: any): string {
    return `
Subscription Renewal Reminder - Continue Your Wellness Journey!

Dear ${context.firstName || 'Valued Member'},

Your Fifty Firsts Wellness subscription is up for renewal!

Renewal Details:
- Current subscription: ${context.subscriptionType || 'Check your account for details'}
- Renewal date: ${context.renewalDate || 'Check your account for the date'}

Why renew:
- Maintain access to all wellness programs
- Keep your progress tracking active
- Continue receiving expert guidance
- Stay connected with our community

Renew now: ${context.renewalLink || 'https://fiftyfirstswellness.com/renew'}

Don't let your wellness journey pause - renew today and keep moving forward!

Best regards,
The Fifty Firsts Wellness Team

---
Contact us at ${context.companyEmail || 'support@fiftyfirstswellness.com'} for assistance.
    `.trim();
  }

  // Default fallback
  private static generateDefaultPlainText(context: any): string {
    return `
Fifty Firsts Wellness

Dear ${context.firstName || 'Valued Member'},

Thank you for being part of the Fifty Firsts Wellness community!

We're committed to supporting you on your wellness journey and providing you with the resources and guidance you need to thrive.

If you have any questions or need assistance, please don't hesitate to contact our support team.

Best regards,
The Fifty Firsts Wellness Team

---
Contact us at ${context.companyEmail || 'support@fiftyfirstswellness.com'} for assistance.
    `.trim();
  }
}
