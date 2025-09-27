import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  CreatePodcastDto,
  CreateUploadUrlResponseDto,
  UpdatePodcast,
  UpdatePodcastThumbnailDto,
} from './dto/create-podcast.dto';
import {
  AccessItem,
  PricingModel,
  ProductType,
  //  PaymentStatus,
} from 'src/database/schema';
import { User } from 'src/database/types';
import { eq, and, gte, lte, desc, count, or } from 'drizzle-orm';
import {
  products,
  podcasts,
  // subscriptions,
  // subscriptionPlans,
  // subscriptionAccess,
} from 'src/database/schema';
import { generateId } from 'src/database/utils';
import { StorageService } from 'src/util/storage/storage.service';
import { DocumentType } from 'src/util/storage/constants';
import { PodcastQueryDto } from './dto/podcast-query.dto';
import { ResponseDto } from 'src/util/dto/response.dto';
import { BaseProductService } from '../../services/base-product.service';
import { v4 as uuidv4 } from 'uuid';
import { MulterFile } from '@/types';
import { ConfigService } from '@nestjs/config';
import { PodcastRepository } from './podcast.repository';

@Injectable()
export class PodcastService extends BaseProductService {
  constructor(
    database: DatabaseService,
    private storageService: StorageService,
    protected configService: ConfigService,
    private podcastRepository: PodcastRepository,
  ) {
    super(database, configService);
  }

  /**
   * Creates a podcast entity and generates Mux upload URL for audio
   */
  async createPodcastUploadUrl(
    createPodcastDto: CreatePodcastDto,
  ): Promise<CreateUploadUrlResponseDto> {
    try {
      // Generate a unique product ID for the podcast
      const productId = generateId();

      // Create product first
      const product = (
        await this.database.db
          .insert(products)
          .values({
            id: productId,
            type: ProductType.PODCAST,
            pricingModel: PricingModel.SUBSCRIPTION,
          })
          .returning()
      )[0];

      // Create podcast
      const podcast = (
        await this.database.db
          .insert(podcasts)
          .values({
            productId: product.id,
            title: createPodcastDto.title,
            description: null,
            muxAssetId: uuidv4(), // Temporary for uniqueness, will be updated via webhook
            muxPlaybackId: uuidv4(), // Temporary, will be updated via webhook
            isPublished: false,
            isFeatured: false,
            requiresAccess: AccessItem.PODCAST_ACCESS,
            duration: 0, // Will be updated via webhook
            podcastProductId: product.id, // Reference to the main podcast product
          })
          .returning()
      )[0];

      // Create Mux direct upload URL for audio
      console.log('Creating Mux upload URL for podcast:', product.id);
      const upload = await this.muxClient.video.uploads.create({
        new_asset_settings: {
          playback_policy: ['signed'],
          passthrough: JSON.stringify({
            productId: product.id,
            title: createPodcastDto.title,
            type: 'podcast', // Mark as podcast for webhook handling
          }),
        },
        cors_origin: '*',
      });
      console.log(
        'Mux upload URL created successfully for podcast:',
        upload.id,
      );

      return {
        uploadUrl: upload.url,
        uploadId: upload.id,
        productId: product.id,
      };
    } catch (error) {
      console.error('Failed to create podcast upload URL:', error);
      console.error(error?.error?.messages?.toString());
      throw new BadRequestException('Could not create upload URL for podcast');
    }
  }

  /**
   * Uploads a thumbnail image for a podcast
   */
  async uploadPodcastThumbnail(
    file: MulterFile,
    updateDto: UpdatePodcastThumbnailDto,
  ) {
    try {
      // Check if the podcast exists
      const existingProduct = (
        await this.database.db
          .select()
          .from(products)
          .where(eq(products.id, updateDto.productId))
      )[0];

      const existingPodcast = (
        await this.database.db
          .select()
          .from(podcasts)
          .where(eq(podcasts.productId, updateDto.productId))
      )[0];

      if (!existingProduct || !existingPodcast) {
        throw new NotFoundException('Podcast not found');
      }

      // Upload thumbnail to storage service (public bucket)
      const uploadResult = await this.storageService.uploadFileWithMetadata(
        file,
        {
          documentType: DocumentType.PROGRAMME_THUMBNAIL, // Reuse same type for now
          fileName: `podcast-thumbnail-${updateDto.productId}`,
          folder: 'podcast-thumbnails',
        },
      );

      // Update the podcast with the new thumbnail URL
      const updatedPodcast = (
        await this.database.db
          .update(podcasts)
          .set({ thumbnail: uploadResult.url })
          .where(eq(podcasts.productId, updateDto.productId))
          .returning()
      )[0];

      return {
        message: 'Thumbnail uploaded successfully',
        thumbnail: uploadResult.url,
        podcast: updatedPodcast,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Failed to upload podcast thumbnail:', error);
      throw new BadRequestException('Could not upload podcast thumbnail');
    }
  }

  /**
   * Removes a podcast thumbnail
   */
  async removePodcastThumbnail(productId: string) {
    try {
      // Check if the podcast exists
      const existingProduct = (
        await this.database.db
          .select()
          .from(products)
          .where(eq(products.id, productId))
      )[0];

      const existingPodcast = (
        await this.database.db
          .select()
          .from(podcasts)
          .where(eq(podcasts.productId, productId))
      )[0];

      if (!existingProduct || !existingPodcast) {
        throw new NotFoundException('Podcast not found');
      }

      if (!existingPodcast.thumbnail) {
        throw new BadRequestException(
          'Podcast does not have a thumbnail to remove',
        );
      }

      // Update the podcast to remove the thumbnail URL
      const updatedPodcast = (
        await this.database.db
          .update(podcasts)
          .set({ thumbnail: null })
          .where(eq(podcasts.productId, productId))
          .returning()
      )[0];

      return {
        message: 'Thumbnail removed successfully',
        podcast: updatedPodcast,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Failed to remove podcast thumbnail:', error);
      throw new BadRequestException('Could not remove podcast thumbnail');
    }
  }

  /**
   * Updates podcast metadata after upload
   */
  async updatePodcastMetadata(podcastId: string, updateDto: UpdatePodcast) {
    try {
      // Check if the podcast exists
      const existingProduct = (
        await this.database.db
          .select()
          .from(products)
          .where(eq(products.id, podcastId))
      )[0];

      const existingPodcast = (
        await this.database.db
          .select()
          .from(podcasts)
          .where(eq(podcasts.productId, podcastId))
      )[0];

      if (!existingProduct || !existingPodcast) {
        throw new NotFoundException('Podcast not found');
      }

      // Update the podcast metadata
      const updatedPodcast = (
        await this.database.db
          .update(podcasts)
          .set({
            description: updateDto.description ?? existingPodcast.description,
            isFeatured: updateDto.isFeatured ?? existingPodcast.isFeatured,
            isPublished: updateDto.isPublished ?? existingPodcast.isPublished,
          })
          .where(eq(podcasts.productId, podcastId))
          .returning()
      )[0];

      return updatedPodcast;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Failed to update podcast metadata:', error);
      throw new BadRequestException('Could not update podcast metadata');
    }
  }

  /**
   * Handles Mux webhook to update podcast with audio asset data
   */
  async handleMuxWebhook(
    muxAssetId: string,
    muxPlaybackId: string,
    passthroughData: any,
    duration: number,
  ) {
    try {
      const { productId } = passthroughData;

      // Update the podcast with Mux asset information
      const updatedPodcast = (
        await this.database.db
          .update(podcasts)
          .set({
            muxAssetId: muxAssetId,
            muxPlaybackId: muxPlaybackId,
            isPublished: true,
            duration: duration,
          })
          .where(eq(podcasts.productId, productId))
          .returning()
      )[0];

      console.log(`Podcast ${productId} updated with Mux asset ${muxAssetId}`);
      return updatedPodcast;
    } catch (error) {
      console.error('Failed to update podcast from webhook:', error);
      throw new BadRequestException(
        'Failed to process Mux webhook for podcast',
      );
    }
  }

  /**
   * Gets a podcast by product ID
   */
  async getPodcastByProductId(productId: string) {
    const product = (
      await this.database.db
        .select()
        .from(products)
        .where(eq(products.id, productId))
    )[0];

    const podcast = (
      await this.database.db
        .select()
        .from(podcasts)
        .where(eq(podcasts.productId, productId))
    )[0];

    if (!product || !podcast) {
      throw new NotFoundException('Podcast not found');
    }

    return podcast;
  }

  /**
   * Gets all podcasts with filtering and pagination
   */
  async getAllPodcasts(query: PodcastQueryDto) {
    const {
      page = 1,
      limit = 20,
      isPublished,
      isFeatured,
      categories,
      search,
    } = query;
    const skip = (page - 1) * limit;

    const filters = { isPublished, isFeatured, categories, search };

    const [podcastResults, total] = await Promise.all([
      this.podcastRepository.findAll(skip, limit, filters),
      this.podcastRepository.count(filters),
    ]);

    return ResponseDto.createPaginatedResponse(
      'Podcasts retrieved successfully',
      podcastResults,
      {
        total,
        page,
        pageSize: limit,
      },
    );
  }

  /**
   * Gets a podcast by ID with subscription-based access control and signed playback token
   */
  async getSecurePodcastById(productId: string, user: User) {
    // Get the podcast
    const product = (
      await this.database.db
        .select()
        .from(products)
        .where(eq(products.id, productId))
    )[0];

    const podcast = (
      await this.database.db
        .select()
        .from(podcasts)
        .where(eq(podcasts.productId, productId))
    )[0];

    if (!product || !podcast) {
      throw new NotFoundException('Podcast not found');
    }

    // Check if podcast is published
    if (!podcast.isPublished) {
      throw new NotFoundException('Podcast not available');
    }

    // Check if user has required access
    const hasAccess = await this.hasActiveSubscription(
      user.id,
      podcast.requiresAccess,
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'You need an active subscription to access this podcast. Please upgrade your plan.',
      );
    }

    // Verify podcast has valid Mux data
    if (!podcast.muxPlaybackId) {
      throw new BadRequestException('Podcast audio is not available');
    }

    // Generate signed playback token
    const signedToken = await this.generateSignedPlaybackToken(
      podcast.muxPlaybackId,
      user.id,
    );

    // Return podcast data with signed token
    return ResponseDto.createSuccessResponse('Podcast retrieved successfully', {
      podcast: {
        ...podcast,
        // Remove sensitive Mux data from response
        muxAssetId: undefined,
      },
      playback: {
        playbackId: podcast.muxPlaybackId,
        signedToken,
        expiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours from now
      },
    });
  }
}
