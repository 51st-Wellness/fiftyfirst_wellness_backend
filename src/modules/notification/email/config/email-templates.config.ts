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
  [EmailType.WAITLIST_SUBSCRIPTION]: 'waitlist-subscription.ejs',

  // Subscription emails
  [EmailType.SUBSCRIPTION_RENEWAL]: 'subscription-renewal.ejs',

  // Payments
  [EmailType.PAYMENT_STATUS_UPDATE]: 'payment-status-update.ejs',

  // Contact form
  [EmailType.CONTACT_FORM_SUBMISSION]: 'contact-form-submission.ejs',

  // Marketplace
  [EmailType.PRODUCT_AVAILABILITY_NOTIFICATION]:
    'product-availability-notification.ejs',
  [EmailType.TRACKING_STATUS_UPDATE]: 'tracking-status-update.ejs',
} as const;
