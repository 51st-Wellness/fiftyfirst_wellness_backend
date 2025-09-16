import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { UserController } from './user.controller';
import { DatabaseModule } from 'src/database/database.module';
import { StorageModule } from 'src/util/storage/storage.module';
import { BookmarkService } from 'src/modules/user/submodules/bookmark/bookmark.service';
import { BookmarkController } from 'src/modules/user/submodules/bookmark/bookmark.controller';
import { CartService } from 'src/modules/user/submodules/cart/cart.service';
import { CartController } from 'src/modules/user/submodules/cart/cart.controller';

@Module({
  imports: [DatabaseModule, StorageModule],
  providers: [UserService, UserRepository, BookmarkService, CartService],
  controllers: [UserController, BookmarkController, CartController],
  exports: [UserService, BookmarkService, CartService],
})
export class UserModule {}
