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
  BadRequestException,
  Res,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { SubscriptionCheckoutDto, PaymentSuccessDto } from './dto/checkout.dto';
import { ResponseDto } from 'src/util/dto/response.dto';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { StrictRoles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/schema';
import { User } from 'src/database/types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Response } from 'express';
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {} // Payment service injection

  @Post('checkout/cart')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async checkoutCartItems(@CurrentUser() user: User) {
    // Initiate cart checkout from user's cart
    const result = await this.paymentService.checkoutCartItems(user);
    return ResponseDto.createSuccessResponse(
      'Cart checkout initiated successfully',
      result,
    );
  }

  @Post('checkout/subscription')
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.USER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async checkoutSubscription(
    @Body() subscriptionDto: SubscriptionCheckoutDto,
    @CurrentUser() user: User,
  ) {
    // Initiate subscription checkout
    const result = await this.paymentService.createSubscriptionCheckout(
      subscriptionDto,
      user,
    );
    return ResponseDto.createSuccessResponse(
      'Subscription checkout initiated successfully',
      result,
    );
  }

  @Post('capture')
  @HttpCode(HttpStatus.OK)
  async capturePayment(@Body() successDto: PaymentSuccessDto) {
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
      req.rawBody || req.body, // Use raw body if available, fallback to parsed
      req.body, // Parsed body for webhook processing
    );
    return {
      success: true,
      processed: result?.processed || false,
      paymentId: (result as any)?.paymentId,
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

  @Get('redirect/success')
  async handlePaymentSuccess(
    @Res() res: Response,
    @Query('session_id') sessionId?: string,
    @Query('token') token?: string,
  ) {
    // Handle successful payment redirect from Stripe/PayPal
    try {
      let result;
      if (sessionId) {
        // Stripe success flow
        result = await this.paymentService.capturePayment(sessionId);
      } else if (token) {
        // PayPal success flow
        result = await this.paymentService.capturePayment(token);
      } else {
        throw new BadRequestException('Missing payment reference');
      }

      // Redirect to frontend success page
      const frontendUrl = process.env.FRONTEND_URL;
      const redirectUrl = `${frontendUrl}/payment/success?status=${result.status}&paymentId=${result.paymentId}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Payment success redirect error:', error);
      const frontendUrl = process.env.FRONTEND_URL;
      const redirectUrl = `${frontendUrl}/payment/error?message=${encodeURIComponent(error.message)}`;
      return res.redirect(redirectUrl);
    }
  }

  @Get('redirect/cancel')
  async handlePaymentCancel(@Res() res?: any) {
    // Handle payment cancellation redirect from Stripe/PayPal
    const frontendUrl = process.env.FRONTEND_URL;
    const redirectUrl = `${frontendUrl}/payment/cancel`;
    return res.redirect(redirectUrl);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancelPayment(@Query('token') token?: string) {
    // Handle payment cancellation from PayPal (legacy endpoint)
    return ResponseDto.createSuccessResponse('Payment cancelled', {
      status: 'CANCELLED',
      token: token || 'unknown',
      message: 'Payment was cancelled by user',
    });
  }
}
