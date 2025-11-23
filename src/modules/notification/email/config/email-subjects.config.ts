import { EmailType } from '../constants/email.enum';

// email type and string link up
export const EmailSubjects: Record<EmailType, string> = {
  // Welcome emails for different user types
  [EmailType.WELCOME_USER]:
    'Welcome to Fifty Firsts Wellness - Your Journey to Midlife Transformation Begins!',
  [EmailType.WELCOME_ADMIN]:
    "Welcome to the Fifty Firsts Wellness Team - Let's Build Something Amazing Together!",

  // Authentication related emails
  [EmailType.PASSWORD_RESET]:
    'Reset Your Password - Fifty Firsts Wellness Account Security',
  [EmailType.EMAIL_VERIFICATION]:
    'Verify Your Email - Complete Your Fifty Firsts Wellness Registration',
  [EmailType.EMAIL_VERIFICATION_SUCCESS]:
    'Email Verified Successfully - Welcome to Fifty Firsts Wellness!',
  [EmailType.LOGIN_REMINDER]:
    'Welcome Back to Fifty Firsts Wellness - Continue Your Wellness Journey!',
  [EmailType.ACCOUNT_ACTIVATION]:
    'Activate Your Fifty Firsts Wellness Account - Start Your Transformation Today!',

  [EmailType.ACCOUNT_DEACTIVATION]:
    'Account Deactivation Confirmation - Fifty Firsts Wellness',
  [EmailType.SUBSCRIPTION_RENEWAL]:
    'Subscription Renewal Reminder - Continue Your Wellness Journey!',
  [EmailType.NEWSLETTER_SUBSCRIPTION]:
    'Welcome to Our Newsletter - Stay Inspired & Informed!',
  [EmailType.WAITLIST_SUBSCRIPTION]:
    'Welcome to Our Waitlist - Stay Inspired & Informed!',

  // Payments
  [EmailType.PAYMENT_STATUS_UPDATE]:
    'Payment Status Update - Fifty Firsts Wellness',

  // Contact form
  [EmailType.CONTACT_FORM_SUBMISSION]:
    'New Contact Form Submission - Fifty Firsts Wellness',

  // Marketplace
  [EmailType.PRODUCT_AVAILABILITY_NOTIFICATION]:
    'Product Update from Fifty Firsts Wellness',
  [EmailType.TRACKING_STATUS_UPDATE]:
    'Tracking Status Update - Fifty Firsts Wellness',
} as const;
