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

@Controller('payment/subscriptions')
@UseGuards(RolesGuard)
@StrictRoles(UserRole.ADMIN)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // Subscription endpoints
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createSubscription(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionService.createSubscription(createSubscriptionDto);
  }

  @Get()
  findAllSubscriptions(@Query() query: SubscriptionQueryDto) {
    return this.subscriptionService.findAllSubscriptions(query);
  }

  @Get('stats')
  getSubscriptionStats() {
    return this.subscriptionService.getSubscriptionStats();
  }

  @Get(':id')
  findOneSubscription(@Param('id') id: string) {
    return this.subscriptionService.findOneSubscription(id);
  }

  @Patch(':id')
  updateSubscription(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionService.updateSubscription(
      id,
      updateSubscriptionDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSubscription(@Param('id') id: string) {
    return this.subscriptionService.removeSubscription(id);
  }

  // Subscription Plan endpoints
  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  createSubscriptionPlan(@Body() createPlanDto: CreateSubscriptionPlanDto) {
    return this.subscriptionService.createSubscriptionPlan(createPlanDto);
  }

  @Get('plans')
  findAllSubscriptionPlans() {
    return this.subscriptionService.findAllSubscriptionPlans();
  }

  @Get('plans/:id')
  findOneSubscriptionPlan(@Param('id') id: string) {
    return this.subscriptionService.findOneSubscriptionPlan(id);
  }

  @Patch('plans/:id')
  updateSubscriptionPlan(
    @Param('id') id: string,
    @Body() updatePlanDto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionService.updateSubscriptionPlan(id, updatePlanDto);
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSubscriptionPlan(@Param('id') id: string) {
    return this.subscriptionService.removeSubscriptionPlan(id);
  }
}
