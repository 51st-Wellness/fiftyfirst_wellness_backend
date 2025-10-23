import { Module } from '@nestjs/common';
import { ConfigModule } from 'src/config/config.module';
import { MailerooService } from './maileroo.service';

@Module({
  imports: [ConfigModule],
  providers: [MailerooService],
  exports: [MailerooService],
})
export class MailerooModule {}
