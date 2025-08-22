import 'dotenv/config';
import { EmailService } from 'src/utils/email/email.service';
import { EmailType } from 'src/utils/email/constants/email.enum';
import { EmailPayloadDto } from 'src/utils/email/dto/email-payload.dto';

// Increase timeout for real email sending
jest.setTimeout(30000);

describe('EmailService sendMail (integration)', () => {
  it('sends a welcome email to enweremproper@gmail.com', async () => {
    // Basic env sanity check to avoid false negatives
    const hasBrevo =
      !!process.env.BREVO_API_KEY && !!process.env.BREVO_SENDER_EMAIL;
    const hasGmail =
      !!process.env.GMAIL_CLIENT_ID &&
      !!process.env.GMAIL_CLIENT_SECRET &&
      !!process.env.GMAIL_REFRESH_TOKEN &&
      !!process.env.COMPANY_EMAIL;

    if (!hasBrevo && !hasGmail) {
      throw new Error(
        'Missing email provider configuration. Set Brevo (BREVO_API_KEY, BREVO_SENDER_EMAIL) or Gmail OAuth (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, COMPANY_EMAIL).',
      );
    }

    const emailService = new EmailService();

    const payload: EmailPayloadDto = {
      to: 'enweremproper@gmail.com',
      type: EmailType.WELCOME_STUDENT,
      context: {
        firstName: 'Enwerem',
        lastName: 'Proper',
        departmentName: 'Engineering',
        role: 'student',
      },
    };

    const result = await emailService.sendMail(payload);
    expect(result).toBe(true);
  });
});
