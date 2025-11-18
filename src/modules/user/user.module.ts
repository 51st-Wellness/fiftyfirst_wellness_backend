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
import { OrderService } from 'src/modules/user/submodules/order/order.service';
import { OrderController } from 'src/modules/user/submodules/order/order.controller';
import { ProgrammeRepository } from 'src/modules/product/submodules/programme/programme.repository';
import { StoreRepository } from 'src/modules/product/submodules/store/store.repository';
import { PaymentModule } from 'src/modules/payment/payment.module';
import { forwardRef } from '@nestjs/common';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => ReviewModule),
  ],
  providers: [
    UserService,
    UserRepository,
    BookmarkService,
    CartService,
    OrderService,
    ProgrammeRepository,
    StoreRepository,
  ],
  controllers: [
    UserController,
    BookmarkController,
    CartController,
    OrderController,
  ],
  exports: [UserService, BookmarkService, CartService, OrderService],
})
export class UserModule {}
