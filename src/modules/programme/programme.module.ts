import { Module } from '@nestjs/common';
import { ProgrammeService } from './programme.service';
import { ProgrammeController } from './programme.controller';
import { MuxWebhookController } from './mux-webhook.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from 'src/modules/user/user.module';
import { StorageModule } from '../../util/storage/storage.module';

@Module({
  imports: [PrismaModule, ConfigModule, UserModule, StorageModule],
  controllers: [ProgrammeController, MuxWebhookController],
  providers: [ProgrammeService],
  exports: [ProgrammeService],
})
export class ProgrammeModule {}
