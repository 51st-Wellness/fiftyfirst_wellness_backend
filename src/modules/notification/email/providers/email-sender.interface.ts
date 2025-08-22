import { RenderedEmailDto } from '../dto/rendered-email.dto';

// Provider interface: send already-rendered emails
export interface EmailSenderProvider {
  sendMail(email: RenderedEmailDto): Promise<boolean>;
}
