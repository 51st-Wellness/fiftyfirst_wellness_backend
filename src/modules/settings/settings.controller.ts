import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/schema';
import { ResponseDto } from 'src/util/dto/response.dto';
import { SettingsService } from './settings.service';
import { UpdateGlobalDiscountDto } from './dto/update-global-discount.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('global-discount')
  async getGlobalDiscount() {
    const config = await this.settingsService.getGlobalDiscount();
    return ResponseDto.createSuccessResponse(
      'Global discount fetched successfully',
      config,
    );
  }

  @Put('global-discount')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async updateGlobalDiscount(@Body() payload: UpdateGlobalDiscountDto) {
    const updated = await this.settingsService.updateGlobalDiscount(payload);
    return ResponseDto.createSuccessResponse(
      'Global discount updated successfully',
      updated,
    );
  }
}
