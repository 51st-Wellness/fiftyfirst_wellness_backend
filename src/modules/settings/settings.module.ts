import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [DatabaseModule, AuthModule, UserModule],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
