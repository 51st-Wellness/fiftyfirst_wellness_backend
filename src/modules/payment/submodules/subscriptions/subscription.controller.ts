import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionQueryDto } from './dto/subscription-query.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { StrictRoles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { ResponseDto } from 'src/util/dto/response.dto';

@Controller('payment/subscriptions')
@UseGuards(RolesGuard)
@StrictRoles(UserRole.ADMIN)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // Subscription Plan endpoints
  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  async createSubscriptionPlan(
    @Body() createPlanDto: CreateSubscriptionPlanDto,
  ) {
    const plan =
      await this.subscriptionService.createSubscriptionPlan(createPlanDto);
    return ResponseDto.createSuccessResponse(
      'Subscription plan created successfully',
      plan,
    );
  }

  @Get('plans')
  async findAllSubscriptionPlans() {
    const plans = await this.subscriptionService.findAllSubscriptionPlans();
    return ResponseDto.createSuccessResponse(
      'Subscription plans retrieved successfully',
      plans,
    );
  }

  @Get('plans/:id')
  async findOneSubscriptionPlan(@Param('id') id: string) {
    const plan = await this.subscriptionService.findOneSubscriptionPlan(id);
    return ResponseDto.createSuccessResponse(
      'Subscription plan retrieved successfully',
      plan,
    );
  }

  @Patch('plans/:id')
  async updateSubscriptionPlan(
    @Param('id') id: string,
    @Body() updatePlanDto: UpdateSubscriptionPlanDto,
  ) {
    const plan = await this.subscriptionService.updateSubscriptionPlan(
      id,
      updatePlanDto,
    );
    return ResponseDto.createSuccessResponse(
      'Subscription plan updated successfully',
      plan,
    );
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSubscriptionPlan(@Param('id') id: string) {
    await this.subscriptionService.removeSubscriptionPlan(id);
    return ResponseDto.createSuccessResponse(
      'Subscription plan deleted successfully',
    );
  }

  // User Subscription endpoints
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    const subscription = await this.subscriptionService.createSubscription(
      createSubscriptionDto,
    );
    return ResponseDto.createSuccessResponse(
      'Subscription created successfully',
      subscription,
    );
  }

  @Get()
  async findAllSubscriptions(@Query() query: SubscriptionQueryDto) {
    const result = await this.subscriptionService.findAllSubscriptions(query);
    return ResponseDto.createPaginatedResponse(
      'Subscriptions retrieved successfully',
      result.data,
      result.pagination,
    );
  }

  @Get('stats')
  async getSubscriptionStats() {
    const stats = await this.subscriptionService.getSubscriptionStats();
    return ResponseDto.createSuccessResponse(
      'Subscription statistics retrieved successfully',
      stats,
    );
  }

  @Get(':id')
  async findOneSubscription(@Param('id') id: string) {
    const subscription = await this.subscriptionService.findOneSubscription(id);
    return ResponseDto.createSuccessResponse(
      'Subscription retrieved successfully',
      subscription,
    );
  }

  @Patch(':id')
  async updateSubscription(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    const subscription = await this.subscriptionService.updateSubscription(
      id,
      updateSubscriptionDto,
    );
    return ResponseDto.createSuccessResponse(
      'Subscription updated successfully',
      subscription,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSubscription(@Param('id') id: string) {
    await this.subscriptionService.removeSubscription(id);
    return ResponseDto.createSuccessResponse(
      'Subscription deleted successfully',
    );
  }
}
