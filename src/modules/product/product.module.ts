import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from 'src/modules/user/user.module';
import { StorageModule } from '../../util/storage/storage.module';
import { ProgrammeController } from 'src/modules/product/submodules/programme/programme.controller';
import { PodcastController } from 'src/modules/product/submodules/podcast/podcast.controller';
import { StoreController } from 'src/modules/product/submodules/store/store.controller';
import { CategoryController } from 'src/modules/product/submodules/category/category.controller';
import { ProgrammeService } from 'src/modules/product/submodules/programme/programme.service';
import { PodcastService } from 'src/modules/product/submodules/podcast/podcast.service';
import { StoreService } from 'src/modules/product/submodules/store/store.service';
import { CategoryServiceProvider } from 'src/modules/product/submodules/category/category.service';
import { CategoryExistsConstraint } from 'src/modules/product/submodules/category/validators/category-exists.validator';
import { StoreRepository } from 'src/modules/product/submodules/store/store.repository';
import { ProgrammeRepository } from 'src/modules/product/submodules/programme/programme.repository';
import { PodcastRepository } from 'src/modules/product/submodules/podcast/podcast.repository';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    UserModule,
    StorageModule,
    ReviewModule,
  ],
  controllers: [
    ProgrammeController,
    PodcastController,
    StoreController,
    CategoryController,
  ],
  providers: [
    ProgrammeService,
    PodcastService,
    StoreService,
    CategoryServiceProvider,
    CategoryExistsConstraint,
    StoreRepository,
    ProgrammeRepository,
    PodcastRepository,
  ],
  exports: [
    ProgrammeService,
    PodcastService,
    StoreService,
    CategoryServiceProvider,
    CategoryExistsConstraint,
  ],
})
export class ProductModule {}
