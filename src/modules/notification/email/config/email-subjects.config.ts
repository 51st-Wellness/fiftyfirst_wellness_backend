import { EmailType } from '../constants/email.enum';

// email type and string link up
export const EmailSubjects: Record<EmailType, string> = {
  // Welcome emails for different user types
  [EmailType.WELCOME_USER]:
    'Welcome to Fifty Firsts Wellness - Your Journey to Midlife Transformation Begins! 🌟',
  [EmailType.WELCOME_ADMIN]:
    "Welcome to the Fifty Firsts Wellness Team - Let's Build Something Amazing Together! 👥",

  // Authentication related emails
  [EmailType.PASSWORD_RESET]:
    'Reset Your Password - Fifty Firsts Wellness Account Security 🔐',
  [EmailType.EMAIL_VERIFICATION]:
    'Verify Your Email - Complete Your Fifty Firsts Wellness Registration ✉️',
  [EmailType.EMAIL_VERIFICATION_SUCCESS]:
    'Email Verified Successfully - Welcome to Fifty Firsts Wellness! ✅',
  [EmailType.LOGIN_REMINDER]:
    'Welcome Back to Fifty Firsts Wellness - Continue Your Wellness Journey! 💫',
  [EmailType.ACCOUNT_ACTIVATION]:
    'Activate Your Fifty Firsts Wellness Account - Start Your Transformation Today! 🚀',

  // Wellness and engagement emails
  [EmailType.WELLNESS_TIP]:
    'Your Daily Wellness Tip - Fifty Firsts Wellness 💚',
  [EmailType.WEEKLY_INSPIRATION]:
    'Weekly Inspiration - Your Midlife Transformation Journey 🌱',
  [EmailType.PROGRAMME_REMINDER]:
    "Don't Miss Out - Your Wellness Programme Awaits! 📅",
  [EmailType.WEBINAR_INVITATION]:
    'Exclusive Webinar Invitation - Fifty Firsts Wellness Live Event 🎥',

  // Community and support emails

  // Business and corporate emails
  [EmailType.CORPORATE_WELCOME]:
    'Welcome to Fifty Firsts Wellness Corporate Solutions - Transform Your Workforce! 🏢',
  [EmailType.WORKSHOP_CONFIRMATION]:
    'Workshop Confirmation - Your Corporate Wellness Journey Begins! 📋',
  [EmailType.POLICY_TOOLKIT_ACCESS]:
    'Access Granted - Fifty Firsts Wellness Policy Toolkit 🛠️',

  // Newsletter and marketing emails
  [EmailType.NEWSLETTER_SUBSCRIPTION]:
    'Welcome to Our Newsletter - Stay Inspired & Informed! 📰',
  [EmailType.PRODUCT_LAUNCH]:
    'Exciting New Product Launch - Fifty Firsts Wellness Innovation! 🆕',
  [EmailType.SPECIAL_OFFER]:
    'Special Offer Just for You - Fifty Firsts Wellness Exclusive! 🎁',

  // Account management emails
  [EmailType.PROFILE_UPDATE]:
    'Profile Updated Successfully - Fifty Firsts Wellness Account 🎯',
  [EmailType.ACCOUNT_DEACTIVATION]:
    'Account Deactivation Confirmation - Fifty Firsts Wellness 👋',
  [EmailType.SUBSCRIPTION_RENEWAL]:
    'Subscription Renewal Reminder - Continue Your Wellness Journey! 🔄',
} as const;
