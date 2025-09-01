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

  // Wellness and engagement emails
  [EmailType.WELLNESS_TIP]: 'wellness-tip.ejs',
  [EmailType.WEEKLY_INSPIRATION]: 'weekly-inspiration.ejs',
  [EmailType.PROGRAMME_REMINDER]: 'programme-reminder.ejs',
  [EmailType.WEBINAR_INVITATION]: 'webinar-invitation.ejs',

  // Business and corporate emails
  [EmailType.CORPORATE_WELCOME]: 'corporate-welcome.ejs',
  [EmailType.WORKSHOP_CONFIRMATION]: 'workshop-confirmation.ejs',
  [EmailType.POLICY_TOOLKIT_ACCESS]: 'policy-toolkit-access.ejs',

  // Newsletter and marketing emails
  [EmailType.NEWSLETTER_SUBSCRIPTION]: 'newsletter-subscription.ejs',
  [EmailType.PRODUCT_LAUNCH]: 'product-launch.ejs',
  [EmailType.SPECIAL_OFFER]: 'special-offer.ejs',

  // Account management emails
  [EmailType.PROFILE_UPDATE]: 'profile-update.ejs',
  [EmailType.ACCOUNT_DEACTIVATION]: 'account-deactivation.ejs',
  [EmailType.SUBSCRIPTION_RENEWAL]: 'subscription-renewal.ejs',
} as const;
