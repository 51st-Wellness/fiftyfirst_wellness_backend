import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { ReviewAdminController } from './review-admin.controller';
import { forwardRef } from '@nestjs/common';
import { UserModule } from '@/modules/user/user.module';

// ReviewModule wires controllers and services for reviews
@Module({
  imports: [DatabaseModule, forwardRef(() => UserModule)],
  controllers: [ReviewController, ReviewAdminController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
