import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import {
  RoyalMailTrackingResponse,
  RoyalMailTrackingStatus,
  RoyalMailApiError,
} from './royal-mail.types';

@Injectable()
export class RoyalMailService {
  private readonly logger = new Logger(RoyalMailService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly configService: ConfigService) {
    // this.apiKey = this.configService.get(ENV.ROYAL_MAIL_API_KEY) || '';
    this.apiUrl =
      this.configService.get(ENV.ROYAL_MAIL_API_URL) ||
      'https://api.royalmail.net/tracking';
    this.clientId = this.configService.get(ENV.ROYAL_MAIL_CLIENT_ID)!;
    this.clientSecret = this.configService.get(ENV.ROYAL_MAIL_CLIENT_SECRET)!;

    if (!this.apiKey) {
      this.logger.warn('Royal Mail API key not configured');
    }
  }

  // Fetch tracking information from Royal Mail API
  async getTrackingStatus(
    trackingReference: string,
  ): Promise<RoyalMailTrackingResponse> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        // 'X-API-Key': this.apiKey,
        'X-IBM-Client-Id': this.clientId,
        'X-IBM-Client-Secret': this.clientSecret,
      };

      // Add OAuth credentials if available
      if (this.clientId && this.clientSecret) {
        const auth = Buffer.from(
          `${this.clientId}:${this.clientSecret}`,
        ).toString('base64');
        headers['Authorization'] = `Basic ${auth}`;
      }

      const response = await fetch(
        `${this.apiUrl}/tracking/${trackingReference}`,
        {
          method: 'GET',
          headers,
        },
      );

      if (!response.ok) {
        const errorData: RoyalMailApiError = await response
          .json()
          .catch(() => ({
            code: 'API_ERROR',
            message: `HTTP ${response.status}: ${response.statusText}`,
          }));

        this.logger.error(
          `Royal Mail API error for tracking ${trackingReference}:`,
          errorData,
        );

        throw new Error(
          errorData.message ||
            `Failed to fetch tracking: ${response.statusText}`,
        );
      }

      const data = await response.json();

      // Transform Royal Mail API response to our format
      return this.transformTrackingResponse(data, trackingReference);
    } catch (error) {
      this.logger.error(
        `Error fetching tracking status for ${trackingReference}:`,
        error,
      );
      throw error;
    }
  }

  // Transform Royal Mail API response to standardized format
  private transformTrackingResponse(
    apiResponse: any,
    trackingReference: string,
  ): RoyalMailTrackingResponse {
    // Map Royal Mail status to our status format
    const statusMap: Record<string, RoyalMailTrackingStatus> = {
      pending: 'pending',
      notfound: 'notfound',
      'info-received': 'inforeceived',
      transit: 'transit',
      pickup: 'pickup',
      undelivered: 'undelivered',
      delivered: 'delivered',
      exception: 'exception',
      expired: 'expired',
    };

    const status = statusMap[apiResponse.status?.toLowerCase()] || 'pending';

    return {
      trackingNumber: trackingReference,
      status,
      events: (apiResponse.events || []).map((event: any) => ({
        timestamp: event.timestamp || event.date || new Date().toISOString(),
        location: event.location || event.office || undefined,
        description: event.description || event.status || 'Status update',
        status: statusMap[event.status?.toLowerCase()] || status,
      })),
      estimatedDeliveryDate: apiResponse.estimatedDeliveryDate,
      lastUpdate: apiResponse.lastUpdate || new Date().toISOString(),
    };
  }

  // Check if status is a final status (delivery complete or failed)
  isFinalStatus(status: RoyalMailTrackingStatus): boolean {
    return ['delivered', 'undelivered', 'exception', 'expired'].includes(
      status,
    );
  }
}
