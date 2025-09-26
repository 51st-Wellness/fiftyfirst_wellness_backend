import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from 'src/modules/user/user.module';
import { StorageModule } from '../../util/storage/storage.module';
import { CategoryModule } from '../category/category.module';
import { ProgrammeController } from 'src/modules/product/submodules/programme/programme.controller';
import { PodcastController } from 'src/modules/product/submodules/podcast/podcast.controller';
import { StoreController } from 'src/modules/product/submodules/store/store.controller';
import { ProgrammeService } from 'src/modules/product/submodules/programme/programme.service';
import { PodcastService } from 'src/modules/product/submodules/podcast/podcast.service';
import { StoreService } from 'src/modules/product/submodules/store/store.service';
import { MuxWebhookController } from 'src/modules/product/controllers/mux-webhook.controller';
import { StoreRepository } from 'src/modules/product/submodules/store/store.repository';
@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    UserModule,
    StorageModule,
    CategoryModule,
  ],
  controllers: [
    ProgrammeController,
    PodcastController,
    StoreController,
    MuxWebhookController,
  ],
  providers: [ProgrammeService, PodcastService, StoreService, StoreRepository],
  exports: [ProgrammeService, PodcastService, StoreService],
})
export class ProductModule {}
