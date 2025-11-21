import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ProductSubscriberRepository } from './product-subscriber.repository';
import { StoreRepository } from './store.repository';
import {
  CreateProductSubscriberDto,
  UpdateProductSubscriberDto,
  ProductSubscriberQueryDto,
  BulkEmailDto,
  SingleEmailDto,
} from './dto/product-subscriber.dto';
import { ProductSubscriberStatus } from '@/database/schema';
import { EmailService } from '@/modules/notification/email/email.service';
import { EmailType } from '@/modules/notification/email/constants/email.enum';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';

@Injectable()
export class ProductSubscriberService {
  private readonly frontendBaseUrl: string;
  private readonly supportEmail: string;

  constructor(
    private readonly repository: ProductSubscriberRepository,
    private readonly storeRepository: StoreRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    const fallbackUrl = 'https://fiftyfirstswellness.com';
    const envUrl = this.configService.get(ENV.FRONTEND_URL, fallbackUrl);
    this.frontendBaseUrl = (envUrl || fallbackUrl).replace(/\/$/, '');
    this.supportEmail = this.configService.get(
      ENV.COMPANY_EMAIL,
      'support@fiftyfirstswellness.com',
    );
  }

  async subscribe(userId: string, dto: CreateProductSubscriberDto) {
    // Check if product exists
    const product = await this.storeRepository.findById(dto.productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if already subscribed
    const existing = await this.repository.findByUserAndProduct(
      userId,
      dto.productId,
    );

    if (existing) {
      if (existing.status === ProductSubscriberStatus.NOTIFIED) {
        await this.repository.update(existing.id, {
          status: ProductSubscriberStatus.PENDING,
        });
        return await this.repository.findOne(existing.id);
      }

      throw new BadRequestException(
        'You are already subscribed to notifications for this product',
      );
    }

    return await this.repository.create(userId, dto.productId);
  }

  async unsubscribe(userId: string, productId: string) {
    const existing = await this.repository.findByUserAndProduct(
      userId,
      productId,
    );

    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    return await this.repository.deleteByUserAndProduct(userId, productId);
  }

  async findAll(query: ProductSubscriberQueryDto) {
    return await this.repository.findAll(query);
  }

  async findOne(id: string) {
    const subscriber = await this.repository.findOne(id);
    if (!subscriber) {
      throw new NotFoundException('Subscriber not found');
    }
    return subscriber;
  }

  async update(id: string, dto: UpdateProductSubscriberDto) {
    const existing = await this.repository.findOne(id);
    if (!existing) {
      throw new NotFoundException('Subscriber not found');
    }

    return await this.repository.update(id, dto);
  }

  async delete(id: string) {
    const existing = await this.repository.findOne(id);
    if (!existing) {
      throw new NotFoundException('Subscriber not found');
    }

    return await this.repository.delete(id);
  }

  async sendBulkEmail(dto: BulkEmailDto) {
    // Get product details
    const product = await this.storeRepository.findById(dto.productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Get all PENDING subscribers for this product
    const subscribers = await this.repository.findByProduct(dto.productId);

    const pendingSubscribers = subscribers.filter(
      (subscriber) => subscriber.status !== ProductSubscriberStatus.NOTIFIED,
    );

    if (pendingSubscribers.length === 0) {
      throw new BadRequestException(
        'All subscribers have already been notified for this product',
      );
    }

    const productUrl = this.buildProductUrl(product.productId);

    const sendResults = await Promise.allSettled(
      pendingSubscribers.map((subscriber) =>
        this.emailService.sendMail({
          to: this.resolveSubscriberEmail(subscriber),
          type: EmailType.PRODUCT_AVAILABILITY_NOTIFICATION,
          subjectOverride: dto.subject,
          context: this.buildEmailContext({
            subscriber,
            product,
            message: dto.message,
            productUrl,
          }),
        }),
      ),
    );

    const successfullyNotifiedIds: string[] = [];
    sendResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successfullyNotifiedIds.push(pendingSubscribers[index].id);
      }
    });

    await Promise.all(
      successfullyNotifiedIds.map((id) =>
        this.repository.update(id, {
          status: ProductSubscriberStatus.NOTIFIED,
        }),
      ),
    );

    return {
      totalPending: pendingSubscribers.length,
      emailsSent: successfullyNotifiedIds.length,
      productName: product.name,
    };
  }

  async sendSingleEmail(dto: SingleEmailDto) {
    const subscriber = await this.repository.findOne(dto.subscriberId);
    if (!subscriber) {
      throw new NotFoundException('Subscriber not found');
    }

    // Get product details
    const product = await this.storeRepository.findById(subscriber.productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const sendResult = await this.emailService.sendMail({
      to: this.resolveSubscriberEmail(subscriber),
      type: EmailType.PRODUCT_AVAILABILITY_NOTIFICATION,
      subjectOverride: dto.subject,
      context: this.buildEmailContext({
        subscriber,
        product,
        message: dto.message,
        productUrl: this.buildProductUrl(product.productId),
      }),
    });

    if (sendResult) {
      await this.repository.update(subscriber.id, {
        status: ProductSubscriberStatus.NOTIFIED,
      });
    }

    return {
      email: this.resolveSubscriberEmail(subscriber),
      productName: product.name,
      notified: sendResult,
    };
  }

  async checkSubscription(userId: string, productId: string) {
    const subscription = await this.repository.findByUserAndProduct(
      userId,
      productId,
    );
    return { isSubscribed: !!subscription, subscription };
  }

  private buildProductUrl(productId: string) {
    return `${this.frontendBaseUrl}/marketplace/${productId}`;
  }

  private buildEmailContext(params: {
    subscriber: any;
    product: any;
    message: string;
    productUrl: string;
  }) {
    const { subscriber, product, message, productUrl } = params;

    const subscriberUser = subscriber?.user ?? {};
    const fallbackName =
      subscriberUser.firstName ||
      subscriberUser.lastName ||
      subscriberUser.email?.split('@')[0] ||
      'there';

    return {
      firstName: fallbackName,
      productName: product.name,
      productDescription: product.description,
      productImage:
        product.display?.url ||
        (Array.isArray(product.images) ? product.images[0] : undefined),
      productUrl,
      ctaText: 'Explore Product',
      message,
      supportEmail: this.supportEmail,
    };
  }

  private resolveSubscriberEmail(subscriber: any): string {
    const email = subscriber?.user?.email || subscriber?.email;

    if (!email) {
      throw new BadRequestException('Subscriber email is missing');
    }

    return email;
  }
}
