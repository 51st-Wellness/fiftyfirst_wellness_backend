import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from 'src/modules/user/user.module';
import { StorageModule } from '../../util/storage/storage.module';
import { ProgrammeController } from 'src/modules/product/submodules/programme/programme.controller';
import { StoreController } from 'src/modules/product/submodules/store/store.controller';
import { ProgrammeService } from 'src/modules/product/submodules/programme/programme.service';
import { StoreService } from 'src/modules/product/submodules/store/store.service';
import { MuxWebhookController } from 'src/modules/product/controllers/mux-webhook.controller';
import { StoreRepository } from 'src/modules/product/submodules/store/store.repository';
@Module({
  imports: [DatabaseModule, ConfigModule, UserModule, StorageModule],
  controllers: [ProgrammeController, StoreController, MuxWebhookController],
  providers: [ProgrammeService, StoreService, StoreRepository],
  exports: [ProgrammeService, StoreService],
})
export class ProductModule {}
