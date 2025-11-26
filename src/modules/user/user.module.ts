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
import { NotificationModule } from '../notification/notification.module';
import { ConfigModule } from 'src/config/config.module';
import { ClickDropService } from '@/modules/tracking/royal-mail/click-drop.service';
import { TrackingModule } from '@/modules/tracking/tracking.module';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => ReviewModule),
    NotificationModule,
    ConfigModule,
  ],
  providers: [
    UserService,
    UserRepository,
    BookmarkService,
    CartService,
    OrderService,
    ProgrammeRepository,
    StoreRepository,
    ClickDropService,
  ],
  controllers: [
    UserController,
    BookmarkController,
    CartController,
    OrderController,
  ],
  exports: [
    UserService,
    BookmarkService,
    CartService,
    OrderService,
    // TrackingModule,
  ],
})
export class UserModule {}
