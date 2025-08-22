import { EmailType } from '../constants/email.enum';

// Map all EmailPaths to their corresponding EJS template filenames
export const EmailTemplates: Record<EmailType, string> = {
  [EmailType.WELCOME_STUDENT]: 'welcome-student.ejs',
  [EmailType.WELCOME_MODERATOR]: 'welcome-moderator.ejs',
  [EmailType.WELCOME_ADMIN]: 'welcome-admin.ejs',
  [EmailType.MATERIAL_REJECTION]: 'material-rejection.ejs',
  [EmailType.BLOG_REJECTION]: 'blog-rejection.ejs',
  [EmailType.COURSE_REJECTION]: 'course-rejection.ejs',
  [EmailType.DLC_REJECTION]: 'dlc-rejection.ejs',
  [EmailType.PASSWORD_RESET]: 'password-reset.ejs',
  [EmailType.EMAIL_VERIFICATION]: 'verify-email.ejs',
  [EmailType.EMAIL_VERIFICATION_SUCCESS]: 'user-verification-success.ejs',
  [EmailType.CONTACT_US]: 'contact-us.ejs',
  [EmailType.MODERATOR_REJECTION]: 'moderator-rejection.ejs',
  [EmailType.ADVERT_REJECTION]: 'advert-rejection.ejs',
} as const;
