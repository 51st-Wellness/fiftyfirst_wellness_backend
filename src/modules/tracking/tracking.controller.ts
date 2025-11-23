import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { AddTrackingDto } from './dto/add-tracking.dto';
import { TrackingStatusDto } from './dto/tracking-response.dto';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/schema';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/database/types';
import { ResponseDto } from 'src/util/dto/response.dto';

@Controller('tracking')
@UseGuards(RolesGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  // Admin: Add/update tracking reference for an order
  @Put('admin/orders/:orderId')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async addTrackingReference(
    @Param('orderId') orderId: string,
    @Body() dto: AddTrackingDto,
  ): Promise<ResponseDto<{ message: string }>> {
    await this.trackingService.addTrackingReference(orderId, dto);

    return ResponseDto.createSuccessResponse(
      'Tracking reference added successfully',
      {
        message: `Tracking reference ${dto.trackingReference} has been added and monitoring started`,
      },
    );
  }

  // Admin: Get tracking status for an order
  @Get('admin/orders/:orderId')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getAdminTrackingStatus(
    @Param('orderId') orderId: string,
  ): Promise<ResponseDto<{ tracking: TrackingStatusDto }>> {
    const tracking = await this.trackingService.getTrackingStatus(orderId);

    return ResponseDto.createSuccessResponse(
      'Tracking status retrieved successfully',
      { tracking },
    );
  }

  // User: Get tracking status for their own order
  @Get('orders/:orderId')
  async getMyTrackingStatus(
    @CurrentUser() user: User,
    @Param('orderId') orderId: string,
  ): Promise<ResponseDto<{ tracking: TrackingStatusDto }>> {
    const tracking = await this.trackingService.getTrackingStatus(
      orderId,
      user.id,
    );

    return ResponseDto.createSuccessResponse(
      'Tracking status retrieved successfully',
      { tracking },
    );
  }

  // User: Manually refresh tracking status
  @Post('orders/:orderId/refresh')
  async refreshTrackingStatus(
    @CurrentUser() user: User,
    @Param('orderId') orderId: string,
  ): Promise<ResponseDto<{ tracking: TrackingStatusDto }>> {
    const tracking = await this.trackingService.refreshTrackingStatus(
      orderId,
      user.id,
    );

    return ResponseDto.createSuccessResponse(
      'Tracking status refreshed successfully',
      { tracking },
    );
  }
}
