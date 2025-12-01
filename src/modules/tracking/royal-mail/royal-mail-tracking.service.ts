import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import {
  RoyalMailSummaryResponse,
  RoyalMailEventsResponse,
  RoyalMailSignatureResponse,
  RoyalMailTrackingErrorResponse,
} from './royal-mail-tracking.types';

// Rate limiter helper for Royal Mail Tracking API
class RateLimiter {
  private lastCallTime = 0;
  private readonly minInterval = 100; // 100ms = 10 calls/second (conservative)

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
export class RoyalMailTrackingService {
  private readonly logger = new Logger(RoyalMailTrackingService.name);
  private readonly apiUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly rateLimiter = new RateLimiter();

  constructor(private readonly configService: ConfigService) {
    this.apiUrl =
      this.configService.get(ENV.ROYAL_MAIL_TRACKING_API_URL) ||
      'https://api.royalmail.net/mailpieces/v2';
    this.clientId =
      this.configService.get(ENV.ROYAL_MAIL_TRACKING_CLIENT_ID) || '';
    this.clientSecret =
      this.configService.get(ENV.ROYAL_MAIL_TRACKING_CLIENT_SECRET) || '';
  }

  // Get summary for one or more tracking numbers (up to 30)
  async getSummary(
    trackingNumbers: string[],
  ): Promise<RoyalMailSummaryResponse> {
    await this.rateLimiter.waitIfNeeded();

    if (trackingNumbers.length === 0) {
      throw new Error('At least one tracking number is required');
    }

    if (trackingNumbers.length > 30) {
      throw new Error('Maximum 30 tracking numbers allowed per request');
    }

    try {
      const mailPieceIds = trackingNumbers.join(',');
      const url = `${this.apiUrl}/summary?mailPieceId=${encodeURIComponent(mailPieceIds)}`;

      this.logger.log(
        `Fetching summary for ${trackingNumbers.length} tracking number(s)`,
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-IBM-Client-Id': this.clientId,
          'X-IBM-Client-Secret': this.clientSecret,
          'X-Accept-RMG-Terms': 'yes',
        },
      });

      if (!response.ok) {
        const errorData: RoyalMailTrackingErrorResponse = await response
          .json()
          .catch(() => ({
            httpCode: response.status.toString(),
            httpMessage: response.statusText,
            errors: [],
          }));

        this.logger.error(
          `Royal Mail Tracking API error (summary):`,
          errorData,
        );

        throw new Error(
          errorData.httpMessage ||
            `Failed to get summary: ${response.statusText}`,
        );
      }

      const data: RoyalMailSummaryResponse = await response.json();
      this.logger.log(
        `Successfully fetched summary for ${data.mailPieces.length} mail piece(s)`,
      );

      console.log('Data:', JSON.stringify(data, null, 2));
      process.exit(0);

      return data;
    } catch (error) {
      this.logger.error(
        `Error fetching summary from Royal Mail Tracking API:`,
        error,
      );
      throw error;
    }
  }

  // Get full tracking events for a single tracking number
  async getEvents(trackingNumber: string): Promise<RoyalMailEventsResponse> {
    await this.rateLimiter.waitIfNeeded();

    try {
      const url = `${this.apiUrl}/${encodeURIComponent(trackingNumber)}/events`;

      this.logger.log(`Fetching events for tracking number: ${trackingNumber}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-IBM-Client-Id': this.clientId,
          'X-IBM-Client-Secret': this.clientSecret,
          'X-Accept-RMG-Terms': 'yes',
        },
      });

      if (!response.ok) {
        const errorData: RoyalMailTrackingErrorResponse = await response
          .json()
          .catch(() => ({
            httpCode: response.status.toString(),
            httpMessage: response.statusText,
            errors: [],
          }));

        this.logger.error(`Royal Mail Tracking API error (events):`, errorData);

        throw new Error(
          errorData.httpMessage ||
            `Failed to get events: ${response.statusText}`,
        );
      }

      const data: RoyalMailEventsResponse = await response.json();

      this.logger.log(
        `Successfully fetched events for tracking number: ${trackingNumber}`,
      );

      return data;
    } catch (error) {
      this.logger.error(
        `Error fetching events from Royal Mail Tracking API:`,
        error,
      );
      throw error;
    }
  }

  // Get signature/proof of delivery for a tracking number
  async getSignature(
    trackingNumber: string,
  ): Promise<RoyalMailSignatureResponse> {
    await this.rateLimiter.waitIfNeeded();

    try {
      const url = `${this.apiUrl}/${encodeURIComponent(trackingNumber)}/signature`;

      this.logger.log(
        `Fetching signature for tracking number: ${trackingNumber}`,
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-IBM-Client-Id': this.clientId,
          'X-IBM-Client-Secret': this.clientSecret,
          'X-Accept-RMG-Terms': 'yes',
        },
      });

      if (!response.ok) {
        const errorData: RoyalMailTrackingErrorResponse = await response
          .json()
          .catch(() => ({
            httpCode: response.status.toString(),
            httpMessage: response.statusText,
            errors: [],
          }));

        this.logger.error(
          `Royal Mail Tracking API error (signature):`,
          errorData,
        );

        throw new Error(
          errorData.httpMessage ||
            `Failed to get signature: ${response.statusText}`,
        );
      }

      const data: RoyalMailSignatureResponse = await response.json();

      this.logger.log(
        `Successfully fetched signature for tracking number: ${trackingNumber}`,
      );

      return data;
    } catch (error) {
      this.logger.error(
        `Error fetching signature from Royal Mail Tracking API:`,
        error,
      );
      throw error;
    }
  }

  // Helper: Check if API is configured
  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }
}
