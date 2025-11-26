import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import {
  CreateOrdersRequest,
  CreateOrdersResponse,
  GetOrderInfoResource,
  DeleteOrdersResource,
  UpdateOrdersStatusRequest,
  UpdateOrderStatusResponse,
  ErrorResponse,
} from './click-drop.types';

// Rate limiter helper for 2 calls per second
class RateLimiter {
  private lastCallTime = 0;
  private readonly minInterval = 500; // 500ms = 2 calls/second

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    if (timeSinceLastCall < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastCall;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastCallTime = Date.now();
  }
}

@Injectable()
export class ClickDropService {
  private readonly logger = new Logger(ClickDropService.name);
  private readonly apiUrl: string;
  private readonly bearerToken: string;
  private readonly mode: string;
  private readonly rateLimiter = new RateLimiter();

  constructor(private readonly configService: ConfigService) {
    this.apiUrl =
      this.configService.get(ENV.CLICK_DROP_API_URL) ||
      'https://api.parcel.royalmail.com';
    this.bearerToken =
      this.configService.get(ENV.CLICK_DROP_BEARER_TOKEN) || '';
    this.mode = this.configService.get(ENV.CLICK_DROP_MODE) || 'production';

    if (!this.bearerToken) {
      this.logger.warn('Click & Drop bearer token not configured');
    }
  }

  // Create orders via Click & Drop API
  async createOrders(
    request: CreateOrdersRequest,
  ): Promise<CreateOrdersResponse> {
    await this.rateLimiter.waitIfNeeded();

    try {
      const url = `${this.apiUrl}/api/v1/orders`;

      this.logger.log(
        `Creating ${request.items.length} order(s) via Click & Drop API`,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({
          message: `HTTP ${response.status}: ${response.statusText}`,
        }));

        this.logger.error(`Click & Drop API error creating orders:`, errorData);

        throw new Error(
          errorData.message ||
            `Failed to create orders: ${response.statusText}`,
        );
      }

      const data: CreateOrdersResponse = await response.json();

      this.logger.log(
        `Successfully created ${data.successCount} order(s), ${data.errorsCount} failed`,
      );

      // Log any failed orders for admin review
      if (data.failedOrders && data.failedOrders.length > 0) {
        data.failedOrders.forEach((failedOrder) => {
          const serviceCodeErrors = failedOrder.errors.filter(
            (error) => error.errorCode === 31 || error.errorMessage.includes('Service code')
          );
          
          if (serviceCodeErrors.length > 0) {
            this.logger.error(
              `INVALID SERVICE CODE for order ${failedOrder.order.orderReference}:`,
              serviceCodeErrors,
              'Please update shipping settings with correct Click & Drop service codes'
            );
          } else {
            this.logger.error(
              `Failed to create order ${failedOrder.order.orderReference}:`,
              failedOrder.errors,
            );
          }
        });
      }

      return data;
    } catch (error) {
      this.logger.error(`Error creating orders via Click & Drop:`, error);
      throw error;
    }
  }

  // Get orders by identifiers (semicolon-separated)
  async getOrdersByIdentifiers(
    orderIdentifiers: string,
  ): Promise<GetOrderInfoResource[]> {
    await this.rateLimiter.waitIfNeeded();

    try {
      // Encode identifiers for URL
      const encodedIdentifiers = encodeURIComponent(orderIdentifiers);
      const url = `${this.apiUrl}/api/v1/orders/${encodedIdentifiers}`;

      this.logger.log(`Fetching orders by identifiers: ${orderIdentifiers}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({
          message: `HTTP ${response.status}: ${response.statusText}`,
        }));

        this.logger.error(`Click & Drop API error fetching orders:`, errorData);

        throw new Error(
          errorData.message || `Failed to fetch orders: ${response.statusText}`,
        );
      }

      const data: GetOrderInfoResource[] = await response.json();

      this.logger.log(`Successfully fetched ${data.length} order(s)`);

      return data;
    } catch (error) {
      this.logger.error(`Error fetching orders by identifiers:`, error);
      throw error;
    }
  }

  // Get order label (returns PDF buffer)
  async getOrderLabel(
    orderIdentifiers: string,
    options?: {
      documentType?: 'postageLabel' | 'despatchNote' | 'CN22' | 'CN23';
      includeReturnsLabel?: boolean;
      includeCN?: boolean;
    },
  ): Promise<Buffer> {
    await this.rateLimiter.waitIfNeeded();

    try {
      const encodedIdentifiers = encodeURIComponent(orderIdentifiers);
      const params = new URLSearchParams();

      if (options?.documentType) {
        params.append('documentType', options.documentType);
      }
      if (options?.includeReturnsLabel !== undefined) {
        params.append(
          'includeReturnsLabel',
          String(options.includeReturnsLabel),
        );
      }
      if (options?.includeCN !== undefined) {
        params.append('includeCN', String(options.includeCN));
      }

      const queryString = params.toString();
      const url = `${this.apiUrl}/api/v1/orders/${encodedIdentifiers}/label${queryString ? `?${queryString}` : ''}`;

      this.logger.log(`Fetching label for orders: ${orderIdentifiers}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({
          message: `HTTP ${response.status}: ${response.statusText}`,
        }));

        this.logger.error(`Click & Drop API error fetching label:`, errorData);

        throw new Error(
          errorData.message || `Failed to fetch label: ${response.statusText}`,
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      this.logger.log(
        `Successfully fetched label PDF (${buffer.length} bytes)`,
      );

      return buffer;
    } catch (error) {
      this.logger.error(`Error fetching order label:`, error);
      throw error;
    }
  }

  // Delete orders (cancel)
  async deleteOrders(orderIdentifiers: string): Promise<DeleteOrdersResource> {
    await this.rateLimiter.waitIfNeeded();

    try {
      const encodedIdentifiers = encodeURIComponent(orderIdentifiers);
      const url = `${this.apiUrl}/api/v1/orders/${encodedIdentifiers}`;

      this.logger.log(`Deleting orders: ${orderIdentifiers}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({
          message: `HTTP ${response.status}: ${response.statusText}`,
        }));

        this.logger.error(`Click & Drop API error deleting orders:`, errorData);

        throw new Error(
          errorData.message ||
            `Failed to delete orders: ${response.statusText}`,
        );
      }

      const data: DeleteOrdersResource = await response.json();

      this.logger.log(
        `Successfully deleted ${data.deletedOrders.length} order(s)`,
      );

      // Log any errors
      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((error) => {
          this.logger.error(
            `Failed to delete order ${error.orderIdentifier || error.orderReference}:`,
            error.message,
          );
        });
      }

      return data;
    } catch (error) {
      this.logger.error(`Error deleting orders:`, error);
      throw error;
    }
  }

  // Update order status
  async updateOrderStatus(
    request: UpdateOrdersStatusRequest,
  ): Promise<UpdateOrderStatusResponse> {
    await this.rateLimiter.waitIfNeeded();

    try {
      const url = `${this.apiUrl}/api/v1/orders/status`;

      this.logger.log(`Updating status for ${request.items.length} order(s)`);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json().catch(() => ({
          message: `HTTP ${response.status}: ${response.statusText}`,
        }));

        this.logger.error(`Click & Drop API error updating status:`, errorData);

        throw new Error(
          errorData.message ||
            `Failed to update status: ${response.statusText}`,
        );
      }

      const data: UpdateOrderStatusResponse = await response.json();

      this.logger.log(
        `Successfully updated ${data.updatedOrders.length} order(s)`,
      );

      // Log any errors
      if (data.errors && data.errors.length > 0) {
        data.errors.forEach((error) => {
          this.logger.error(
            `Failed to update order ${error.orderIdentifier || error.orderReference}:`,
            error.message,
          );
        });
      }

      return data;
    } catch (error) {
      this.logger.error(`Error updating order status:`, error);
      throw error;
    }
  }

  // Helper: Check if API is configured
  isConfigured(): boolean {
    return !!this.bearerToken && !!this.apiUrl;
  }

  // Helper: Get mode (sandbox/production)
  getMode(): string {
    return this.mode;
  }
}
