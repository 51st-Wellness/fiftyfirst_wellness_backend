import { Controller, Get, Put, Body, UseGuards, Query } from '@nestjs/common';
import { ShippingService, ShippingRatesConfig, CartItemForShipping } from './shipping.service';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/schema';
import { ResponseDto } from 'src/util/dto/response.dto';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // Get available shipping services
  @Get('services')
  async getAvailableServices(
    @Query('weight') weight?: string,
  ): Promise<ResponseDto<any>> {
    const weightGrams = weight ? parseInt(weight, 10) : 1000; // Default 1kg
    const services = await this.shippingService.getAvailableServices(weightGrams);

    return ResponseDto.createSuccessResponse(
      'Shipping services retrieved successfully',
      { services },
    );
  }

  // Estimate shipping cost for cart
  @Put('estimate')
  async estimateShipping(
    @Body() payload: {
      items: CartItemForShipping[];
      serviceKey?: string;
      addOnKeys?: string[];
    },
  ): Promise<ResponseDto<any>> {
    const calculation = await this.shippingService.calculateShippingCost(
      payload.items,
      payload.serviceKey,
      payload.addOnKeys,
    );

    return ResponseDto.createSuccessResponse(
      'Shipping cost estimated successfully',
      calculation,
    );
  }

  // Get shipping rates configuration (admin only)
  @Get('rates')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getShippingRates(): Promise<ResponseDto<ShippingRatesConfig>> {
    const rates = await this.shippingService.getShippingRates();

    return ResponseDto.createSuccessResponse(
      'Shipping rates retrieved successfully',
      rates,
    );
  }

  // Update shipping rates configuration (admin only)
  @Put('rates')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateShippingRates(
    @Body() config: ShippingRatesConfig,
  ): Promise<ResponseDto<{ message: string }>> {
    await this.shippingService.updateShippingRates(config);

    return ResponseDto.createSuccessResponse(
      'Shipping rates updated successfully',
      { message: 'Shipping configuration has been updated' },
    );
  }
}

