import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { UserController } from './user.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StorageModule } from 'src/util/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [UserService, UserRepository],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
