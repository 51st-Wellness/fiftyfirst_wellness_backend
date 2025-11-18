import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderSummaryDto, OrderWithRelations } from './dto/order-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/database/types';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { ResponseDto } from 'src/util/dto/response.dto';
import { PaymentService } from 'src/modules/payment/payment.service';

@Controller('user/orders')
@UseGuards(RolesGuard)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

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

  // Manually verify payment status for an order
  @Post('me/:id/verify-payment')
  async verifyOrderPayment(
    @CurrentUser() user: User,
    @Param('id') orderId: string,
  ): Promise<
    ResponseDto<{ updated: boolean; status: string; message: string }>
  > {
    const order = await this.orderService.getUserOrder(user.id, orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.paymentId) {
      throw new BadRequestException(
        'Order does not have an associated payment',
      );
    }

    const verificationResult = await this.paymentService.verifyPaymentStatus(
      order.paymentId,
    );

    return ResponseDto.createSuccessResponse(
      verificationResult.updated
        ? 'Payment status verified and updated'
        : 'Payment status verified',
      {
        updated: verificationResult.updated,
        status: verificationResult.status,
        message: verificationResult.message,
      },
    );
  }
}
