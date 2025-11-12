import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderSummaryDto, OrderWithRelations } from './dto/order-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/database/types';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { ResponseDto } from 'src/util/dto/response.dto';

@Controller('user/orders')
@UseGuards(RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // Get all orders for current user
  @Get('me')
  async getMyOrders(
    @CurrentUser() user: User,
  ): Promise<ResponseDto<{ orders: OrderSummaryDto[] }>> {
    const orders = await this.orderService.getUserOrders(user.id);

    return ResponseDto.createSuccessResponse('Orders retrieved successfully', {
      orders,
    });
  }

  // Get a single order by ID for current user
  @Get('me/:id')
  async getMyOrder(
    @CurrentUser() user: User,
    @Param('id') orderId: string,
  ): Promise<ResponseDto<{ order: OrderWithRelations }>> {
    const order = await this.orderService.getUserOrder(user.id, orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return ResponseDto.createSuccessResponse('Order retrieved successfully', {
      order,
    });
  }
}
