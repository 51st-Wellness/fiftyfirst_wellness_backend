import { EmailType } from '../constants/email.enum';

export class EmailPayloadDto {
  to: string;
  type: EmailType;
  subjectOverride?: string;
  context: Record<string, any>;
}
