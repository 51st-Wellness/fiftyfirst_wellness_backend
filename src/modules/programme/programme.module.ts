import { Module } from '@nestjs/common';
import { ProgrammeService } from './programme.service';
import { ProgrammeController } from './programme.controller';
import { MuxWebhookController } from './mux-webhook.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { MuxConfig } from '../../config/mux.config';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ProgrammeController, MuxWebhookController],
  providers: [ProgrammeService, MuxConfig],
  exports: [ProgrammeService],
})
export class ProgrammeModule {}
