import { forwardRef, Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { SettingsModule } from '../settings/settings.module';
import { DatabaseModule } from 'src/database/database.module';
import { UserModule } from '@/modules/user/user.module';

@Module({
  imports: [SettingsModule, DatabaseModule, forwardRef(() => UserModule)],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
