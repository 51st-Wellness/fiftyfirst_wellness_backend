import { EmailType } from '../constants/email.enum';

// Map all EmailPaths to their corresponding EJS template filenames
export const EmailTemplates: Record<EmailType, string> = {
  // Welcome emails for different user types
  [EmailType.WELCOME_USER]: 'welcome-user.ejs',
  [EmailType.WELCOME_ADMIN]: 'welcome-admin.ejs',

  // Authentication related emails
  [EmailType.PASSWORD_RESET]: 'password-reset.ejs',
  [EmailType.EMAIL_VERIFICATION]: 'verify-email.ejs',
  [EmailType.EMAIL_VERIFICATION_SUCCESS]: 'user-verification-success.ejs',
  [EmailType.LOGIN_REMINDER]: 'login-reminder.ejs',
  [EmailType.ACCOUNT_ACTIVATION]: 'account-activation.ejs',

  // Account management emails
  [EmailType.ACCOUNT_DEACTIVATION]: 'account-deactivation.ejs',

  // Newsletter and marketing emails
  [EmailType.NEWSLETTER_SUBSCRIPTION]: 'newsletter-subscription.ejs',

  // Subscription emails
  [EmailType.SUBSCRIPTION_RENEWAL]: 'subscription-renewal.ejs',
} as const;
