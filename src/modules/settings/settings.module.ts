import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => UserModule)],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
