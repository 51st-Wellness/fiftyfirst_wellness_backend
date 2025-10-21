import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';

import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/schema';
import { ResponseDto } from 'src/util/dto/response.dto';

@Controller('stats')
@UseGuards(RolesGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @Roles(UserRole.ADMIN)
  async getOverviewStats() {
    const stats = await this.statsService.getOverviewStats();
    return ResponseDto.createSuccessResponse(
      'Overview statistics retrieved successfully',
      stats,
    );
  }

  @Get('programmes')
  @Roles(UserRole.ADMIN)
  async getProgrammeStats() {
    const stats = await this.statsService.getProgrammeStats();
    return ResponseDto.createSuccessResponse(
      'Programme statistics retrieved successfully',
      stats,
    );
  }
}
