import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmailPayloadDto } from 'src/modules/notification/email/dto/email-payload.dto';
import { EVENTS } from './events.enum';

@Injectable()
export class EventsEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  // Send email notification using the event system
  sendEmail(emailPayload: EmailPayloadDto) {
    this.eventEmitter.emit(EVENTS.NOTIFICATION_EMAIL, emailPayload);
  }
}
