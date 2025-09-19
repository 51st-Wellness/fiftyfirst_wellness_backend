import {
  Controller,
  Post,
  Body,
  Req,
  Query,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import {
  CheckoutDto,
  SubscriptionCheckoutDto,
  PaymentSuccessDto,
} from './dto/checkout.dto';
import { ResponseDto } from 'src/util/dto/response.dto';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { StrictRoles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/schema';
import { User } from 'src/database/types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {} // Payment service injection

  @Post('checkout/store')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async checkoutCartItems(
    @Body() checkoutDto: CheckoutDto,
    @CurrentUser() user: User,
  ) {
    // Initiate store checkout from user's cart
    const result = await this.paymentService.checkoutCartItems(
      checkoutDto,
      user,
    );
    return ResponseDto.createSuccessResponse(
      'Store checkout initiated successfully',
      result,
    );
  }

  @Post('checkout/subscription')
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.USER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async checkoutSubscription(@Body() subscriptionDto: SubscriptionCheckoutDto) {
    // Initiate subscription checkout
    const result =
      await this.paymentService.createSubscriptionCheckout(subscriptionDto);
    return ResponseDto.createSuccessResponse(
      'Subscription checkout initiated successfully',
      result,
    );
  }

  @Post('capture')
  @HttpCode(HttpStatus.OK)
  async capturePayment(@Body() successDto: PaymentSuccessDto) {
    // Capture payment after user approval from PayPal
    const result = await this.paymentService.capturePayment(successDto.token);
    return ResponseDto.createSuccessResponse(
      'Payment captured successfully',
      result,
    );
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: any) {
    // Handle webhook notifications from payment provider
    const result = await this.paymentService.handleWebhook(
      req.headers,
      req.body,
    );
    return {
      success: true,
      processed: result?.processed || false,
      paymentId: result?.paymentId,
    };
  }

  @Get('status/:paymentId')
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.USER, UserRole.ADMIN)
  async getPaymentStatus(@Param('paymentId') paymentId: string) {
    // Get payment status by ID
    const payment = await this.paymentService.getPaymentStatus(paymentId);
    return ResponseDto.createSuccessResponse(
      'Payment status retrieved successfully',
      payment,
    );
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancelPayment(@Query('token') token?: string) {
    // Handle payment cancellation from PayPal
    return ResponseDto.createSuccessResponse('Payment cancelled', {
      status: 'CANCELLED',
      token: token || 'unknown',
      message: 'Payment was cancelled by user',
    });
  }
}
