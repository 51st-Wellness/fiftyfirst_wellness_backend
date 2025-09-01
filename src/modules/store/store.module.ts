import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { StoreRepository } from './store.repository';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/util/storage/storage.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [PrismaModule, StorageModule, UserModule],
  controllers: [StoreController],
  providers: [StoreService, StoreRepository],
  exports: [StoreService],
})
export class StoreModule {}
