import { Global, Module } from '@nestjs/common';
import { ConfigModule } from 'src/config/config.module';
import { StructuredLoggerService } from 'src/lib/logging';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { EventsListeners } from 'src/util/events/event.listener';
import { EventsEmitter } from 'src/util/events/events.emitter';

@Global()
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    NotificationModule,
  ],
  providers: [StructuredLoggerService, EventsEmitter, EventsListeners],
  exports: [
    ConfigModule,
    StructuredLoggerService,
    EventEmitterModule,
    EventsEmitter,
    // EventsListeners,
  ],
})
export class CommonModule {}
