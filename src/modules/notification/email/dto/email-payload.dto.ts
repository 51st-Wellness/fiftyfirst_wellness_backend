import { EmailType } from '../constants/email.enum';

export class EmailPayloadDto {
  to: string;
  type: EmailType;
  context: Record<string, any>;
}
