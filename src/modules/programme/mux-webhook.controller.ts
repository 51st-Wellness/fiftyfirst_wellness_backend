import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ProgrammeService } from './programme.service';
import * as crypto from 'crypto';
import { configService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import { MuxWebhookEventDto } from 'src/modules/programme/dto/mux-webhook-event.dto';

@Controller('webhooks/mux')
export class MuxWebhookController {
  private readonly logger = new Logger(MuxWebhookController.name);

  constructor(private readonly programmeService: ProgrammeService) {}

  /**
   * Handles Mux webhooks for video asset processing
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleMuxWebhook(
    @Body() event: MuxWebhookEventDto,
    @Headers('mux-signature') signature: string,
  ) {
    try {
      // Validate webhook signature for security
      if (!this.validateWebhookSignature(event, signature)) {
        this.logger.error('Invalid Mux webhook signature');
        throw new BadRequestException('Invalid webhook signature');
      }

      this.logger.log(`Received Mux webhook event: ${event.type}`);

      // Handle different Mux event types
      switch (event.type) {
        case 'video.asset.ready':
          await this.handleVideoAssetReady(event);
          break;
        case 'video.asset.errored':
          await this.handleVideoAssetErrored(event);
          break;
        default:
          this.logger.log(`Unhandled Mux event type: ${event.type}`);
      }

      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Error processing Mux webhook:', error);
      throw new BadRequestException('Failed to process webhook');
    }
  }

  /**
   * Handles video.asset.ready event - video is processed and ready for playback
   */
  private async handleVideoAssetReady(event: MuxWebhookEventDto) {
    try {
      const assetId = event.data.id;
      const playbackId = event.data.playback_ids?.[0]?.id;
      const duration = event.data.duration || 0;

      if (!event.data.passthrough) {
        this.logger.error('No passthrough data found in Mux webhook');
        return;
      }

      const passthroughData = JSON.parse(event.data.passthrough) as {
        productId: string;
      };

      if (!passthroughData.productId) {
        this.logger.error('No productId found in passthrough data');
        return;
      }

      this.logger.log(
        `Processing video asset ready for product: ${passthroughData.productId}`,
      );

      await this.programmeService.handleMuxWebhook(
        assetId,
        playbackId,
        passthroughData,
        Math.round(duration), // Convert to integer seconds
      );

      this.logger.log(
        `Successfully updated programme ${passthroughData.productId} with Mux asset ${assetId}`,
      );
    } catch (error) {
      this.logger.error('Error handling video.asset.ready event:', error);
      throw error;
    }
  }

  /**
   * Handles video.asset.errored event - video processing failed
   */
  private async handleVideoAssetErrored(event: MuxWebhookEventDto) {
    this.logger.error(
      `Mux video asset processing failed: ${event.data.id}`,
      (event.data as any).error,
    );
    // TODO: Implement error handling logic (e.g., notify user, mark programme as failed)
  }

  /**
   * Validates Mux webhook signature for security
   */
  private validateWebhookSignature(event: any, signature: string): boolean {
    try {
      if (!signature) {
        return false;
      }

      const secret = configService.get(ENV.MUX_WEBHOOK_SECRET);
      const parts = signature.split(',');

      if (parts.length !== 2) {
        return false;
      }

      const [timestampPart, signaturePart] = parts;
      const timestamp = timestampPart.split('=')[1];
      const expectedSignature = signaturePart.split('=')[1];

      // Create HMAC signature
      const hmac = crypto.createHmac('sha256', secret);
      const payload = `${timestamp}.${JSON.stringify(event)}`;
      hmac.update(payload);
      const computedSignature = hmac.digest('hex');

      // Use crypto.timingSafeEqual for secure comparison
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const computedBuffer = Buffer.from(computedSignature, 'hex');

      return (
        expectedBuffer.length === computedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, computedBuffer)
      );
    } catch (error) {
      this.logger.error('Error validating webhook signature:', error);
      return false;
    }
  }
}
