import { forwardRef, Global, Module } from '@nestjs/common';
import { ConfigModule } from 'src/config/config.module';
import { StructuredLoggerService } from 'src/lib/logging';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { EventsListeners } from 'src/util/events/event.listener';
import { EventsEmitter } from 'src/util/events/events.emitter';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RolesGuard } from './gaurds/roles.guard';
import { UserModule } from 'src/modules/user/user.module';

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
    // forwardRef(() => UserModule),
    // forwardRef(() => AuthModule),
    AuthModule,
  ],
  providers: [
    StructuredLoggerService,
    EventsEmitter,
    EventsListeners,
    // RolesGuard,
  ],
  exports: [
    ConfigModule,
    StructuredLoggerService,
    EventEmitterModule,
    EventsEmitter,
    // RolesGuard,
    AuthModule,
    EventsListeners,
  ],
})
export class CommonModule {}
