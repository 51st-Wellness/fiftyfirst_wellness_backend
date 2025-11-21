import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import {
  OrderSummaryDto,
  OrderWithRelations,
  AdminOrderListItem,
  AdminOrderDetail,
} from './dto/order-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/database/types';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole, OrderStatus } from 'src/database/schema';
import { ResponseDto } from 'src/util/dto/response.dto';
import { PaymentService } from 'src/modules/payment/payment.service';
import { PreOrderBulkEmailDto } from './dto/pre-order-bulk-email.dto';

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

  // Admin endpoints
  @Get('admin')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getAdminOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OrderStatus,
    @Query('search') search?: string,
  ): Promise<
    ResponseDto<{
      orders: AdminOrderListItem[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>
  > {
    const result = await this.orderService.getAdminOrders({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      search,
    });

    return ResponseDto.createSuccessResponse('Orders retrieved successfully', {
      orders: result.orders,
      pagination: result.pagination,
    });
  }

  @Get('admin/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getAdminOrder(
    @Param('id') orderId: string,
  ): Promise<ResponseDto<{ order: AdminOrderDetail }>> {
    const order = await this.orderService.getAdminOrder(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return ResponseDto.createSuccessResponse('Order retrieved successfully', {
      order,
    });
  }

  @Put('admin/:id/status')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async updateOrderStatus(
    @Param('id') orderId: string,
    @Body('status') status: OrderStatus,
  ): Promise<ResponseDto<{ order: AdminOrderDetail }>> {
    if (!status) {
      throw new BadRequestException('Status is required');
    }

    const validStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.PROCESSING,
      OrderStatus.PACKAGING,
      OrderStatus.IN_TRANSIT,
      OrderStatus.FULFILLED,
    ];

    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Invalid order status');
    }

    const order = await this.orderService.updateAdminOrderStatus(
      orderId,
      status,
    );

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return ResponseDto.createSuccessResponse(
      'Order status updated successfully',
      { order },
    );
  }

  @Post('admin/:id/fulfill-preorder')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async fulfillPreOrder(
    @Param('id') orderId: string,
  ): Promise<ResponseDto<{ message: string }>> {
    await this.paymentService.fulfillPreOrder(orderId);

    return ResponseDto.createSuccessResponse(
      'Pre-order fulfilled successfully. Remaining payment captured and order status updated.',
      { message: 'Pre-order fulfilled' },
    );
  }

  @Get('admin/pre-orders')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getPreOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('preOrderStatus') preOrderStatus?: string,
    @Query('search') search?: string,
  ): Promise<
    ResponseDto<{
      orders: AdminOrderListItem[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>
  > {
    const result = await this.orderService.getPreOrders({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      preOrderStatus,
      search,
    });

    return ResponseDto.createSuccessResponse(
      'Pre-orders retrieved successfully',
      {
        orders: result.orders,
        pagination: result.pagination,
      },
    );
  }

  @Post('admin/pre-orders/bulk-email')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async sendBulkEmailToPreOrders(@Body() dto: PreOrderBulkEmailDto): Promise<
    ResponseDto<{
      totalSent: number;
      totalPreOrders: number;
      productName: string;
    }>
  > {
    const result = await this.orderService.sendBulkEmailToPreOrders(dto);
    return ResponseDto.createSuccessResponse(
      'Bulk email sent to pre-order customers successfully',
      result,
    );
  }
}
