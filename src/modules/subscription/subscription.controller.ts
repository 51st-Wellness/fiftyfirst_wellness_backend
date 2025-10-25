import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { NewsletterSubscriptionDto } from './dto/newsletter-subscription.dto';
import { WaitlistSubscriptionDto } from './dto/waitlist-subscription.dto';
import { ContactFormDto } from './dto/contact-form.dto';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * Subscribe to newsletter
   */
  @Post('newsletter')
  @HttpCode(HttpStatus.OK)
  async subscribeToNewsletter(
    @Body() subscriptionData: NewsletterSubscriptionDto,
  ) {
    return this.subscriptionService.subscribeToNewsletter(subscriptionData);
  }

  /**
   * Subscribe to waitlist
   */
  @Post('waitlist')
  @HttpCode(HttpStatus.OK)
  async subscribeToWaitlist(@Body() subscriptionData: WaitlistSubscriptionDto) {
    return this.subscriptionService.subscribeToWaitlist(subscriptionData);
  }

  /**
   * Unsubscribe from newsletter
   */
  @Delete('newsletter/:email')
  @HttpCode(HttpStatus.OK)
  async unsubscribeFromNewsletter(@Param('email') email: string) {
    return this.subscriptionService.unsubscribeFromNewsletter(email);
  }

  /**
   * Remove from waitlist
   */
  @Delete('waitlist/:email')
  @HttpCode(HttpStatus.OK)
  async removeFromWaitlist(@Param('email') email: string) {
    return this.subscriptionService.removeFromWaitlist(email);
  }

  /**
   * Submit contact form
   */
  @Post('contact')
  @HttpCode(HttpStatus.OK)
  async submitContactForm(@Body() contactData: ContactFormDto) {
    return this.subscriptionService.submitContactForm(contactData);
  }
}
