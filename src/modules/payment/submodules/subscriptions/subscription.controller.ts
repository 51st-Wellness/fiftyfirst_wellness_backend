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
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionQueryDto } from './dto/subscription-query.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { StrictRoles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/database/schema';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { ResponseDto } from 'src/util/dto/response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from 'src/database/types';

@Controller('payment/subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // Subscription Plan endpoints (Admin only)
  @Post('plans')
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.ADMIN)
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
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.ADMIN)
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
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSubscriptionPlan(@Param('id') id: string) {
    await this.subscriptionService.removeSubscriptionPlan(id);
    return ResponseDto.createSuccessResponse(
      'Subscription plan deleted successfully',
    );
  }

  // Admin Subscription endpoints
  @Post()
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.ADMIN)
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
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.ADMIN)
  async getSubscriptionStats() {
    const stats = await this.subscriptionService.getSubscriptionStats();
    return ResponseDto.createSuccessResponse(
      'Subscription statistics retrieved successfully',
      stats,
    );
  }

  @Get('user/active')
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.USER, UserRole.ADMIN)
  async getCurrentUserActiveSubscription(@CurrentUser() user: User) {
    const subscription =
      await this.subscriptionService.getUserActiveSubscription(user.id);
    return ResponseDto.createSuccessResponse(
      'User subscription retrieved successfully',
      subscription,
    );
  }

  @Get('user')
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.USER, UserRole.ADMIN)
  async getCurrentUserSubscriptions(@CurrentUser() user: User) {
    const subscriptions = await this.subscriptionService.findAllSubscriptions({
      userId: user.id,
      page: 1,
      limit: 100,
    });
    return ResponseDto.createSuccessResponse(
      'User subscriptions retrieved successfully',
      subscriptions.data,
    );
  }

  @Get('my/:userId')
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.USER, UserRole.ADMIN)
  async getUserActiveSubscription(@Param('userId') userId: string) {
    const subscription =
      await this.subscriptionService.getUserActiveSubscription(userId);
    return ResponseDto.createSuccessResponse(
      'User subscription retrieved successfully',
      subscription,
    );
  }

  @Get('access/:userId/:accessItem')
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.USER, UserRole.ADMIN)
  async checkUserAccess(
    @Param('userId') userId: string,
    @Param('accessItem') accessItem: string,
  ) {
    const hasAccess = await this.subscriptionService.hasUserAccessToItem(
      userId,
      accessItem,
    );
    return ResponseDto.createSuccessResponse('Access check completed', {
      hasAccess,
      accessItem,
      userId,
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.ADMIN)
  async findOneSubscription(@Param('id') id: string) {
    const subscription = await this.subscriptionService.findOneSubscription(id);
    return ResponseDto.createSuccessResponse(
      'Subscription retrieved successfully',
      subscription,
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.ADMIN)
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
  @UseGuards(RolesGuard)
  @StrictRoles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSubscription(@Param('id') id: string) {
    await this.subscriptionService.removeSubscription(id);
    return ResponseDto.createSuccessResponse(
      'Subscription deleted successfully',
    );
  }
}
