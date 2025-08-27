import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { StoreRepository } from './store.repository';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/util/storage/storage.module';
import { LoggingModule } from 'src/lib/logging';

@Module({
  imports: [PrismaModule, StorageModule, LoggingModule],
  controllers: [StoreController],
  providers: [StoreService, StoreRepository],
  exports: [StoreService],
})
export class StoreModule {}
