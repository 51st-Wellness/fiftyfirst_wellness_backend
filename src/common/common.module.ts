import { Global, Module } from '@nestjs/common';
import { ConfigModule } from 'src/config/config.module';
import { StructuredLoggerService } from 'src/lib/logging';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [StructuredLoggerService],
  exports: [ConfigModule, StructuredLoggerService],
})
export class CommonModule {}
