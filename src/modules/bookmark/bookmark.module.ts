import { Module } from '@nestjs/common';
import { BookmarkService } from './bookmark.service';
import { BookmarkController } from './bookmark.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserModule } from 'src/modules/user/user.module';

@Module({
  imports: [PrismaModule, UserModule],
  providers: [BookmarkService],
  controllers: [BookmarkController],
  exports: [BookmarkService],
})
export class BookmarkModule {}
