import { Module } from '@nestjs/common';
import { StatsService } from '@/modules/stats/stats.service';
import { StatsController } from '@/modules/stats/stats.controller';
import { DatabaseModule } from 'src/database/database.module';
import { UserModule } from '@/modules/user/user.module';

@Module({
  imports: [DatabaseModule, UserModule],
  providers: [StatsService],
  controllers: [StatsController],
  exports: [StatsService],
})
export class StatsModule {}
