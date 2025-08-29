import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { StoreRepository } from './store.repository';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/util/storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from 'src/modules/user/user.module';

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, UserModule],
  controllers: [StoreController],
  providers: [StoreService, StoreRepository],
  exports: [StoreService],
})
export class StoreModule {}
