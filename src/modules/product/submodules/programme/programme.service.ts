import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  CreateProgrammeDto,
  CreateProgrammeDraftDto,
  UpdateProgrammeDetailsDto,
  CreateUploadUrlResponseDto,
  UpdateProgramme,
  UpdateProgrammeThumbnailDto,
} from './dto/create-programme.dto';
import {
  AccessItem,
  PricingModel,
  ProductType,
  PaymentStatus,
} from 'src/database/schema';
import { User, Product, Programme } from 'src/database/types';
import { eq, and, gte, lte, desc, count, or } from 'drizzle-orm';
import {
  products,
  programmes,
  // subscriptions,
  // subscriptionPlans,
  // subscriptionAccess,
} from 'src/database/schema';
import { generateId } from 'src/database/utils';
import { StorageService } from 'src/util/storage/storage.service';
import { DocumentType } from 'src/util/storage/constants';
import { ProgrammeQueryDto } from './dto/programme-query.dto';
import { ResponseDto } from 'src/util/dto/response.dto';
import { BaseProductService } from '../../services/base-product.service';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { ProgrammeRepository } from './programme.repository';
import axios from 'axios';
import { MulterFile } from '@/types';

@Injectable()
export class ProgrammeService extends BaseProductService {
  constructor(
    database: DatabaseService,
    private storageService: StorageService,
    configService: ConfigService,
    private programmeRepository: ProgrammeRepository,
  ) {
    super(database, configService);
  }

  /**
   * Creates a programme entity and handles video upload to Mux directly
   */
  async createProgrammeWithVideo(
    createProgrammeDto: CreateProgrammeDto,
    videoFile: any,
    thumbnailFile?: any,
  ): Promise<any> {
    try {
      // Generate a unique product ID for the programme
      const productId = generateId();

      // Create product first
      const product = (
        await this.database.db
          .insert(products)
          .values({
            id: productId,
            type: ProductType.PROGRAMME,
            pricingModel: PricingModel.FREE,
          })
          .returning()
      )[0];

      // Create programme with initial data
      const programme = (
        await this.database.db
          .insert(programmes)
          .values({
            productId: product.id,
            title: createProgrammeDto.title,
            description: createProgrammeDto.description || null,
            muxAssetId: null, // Will be set after Mux upload
            muxPlaybackId: null, // Will be set after Mux upload
            isPublished: createProgrammeDto.isPublished || false,
            isFeatured: createProgrammeDto.isFeatured || false,
            requiresAccess: AccessItem.PROGRAMME_ACCESS,
            duration: 0, // Will be updated after Mux processing
            categories: createProgrammeDto.categories
              ? (createProgrammeDto.categories as any)
              : ([] as any),
          })
          .returning()
      )[0];

      // Upload video to Mux using direct upload
      console.log('Creating Mux upload for product:', product.id);

      // First create a direct upload URL
      const upload = await this.muxClient.video.uploads.create({
        new_asset_settings: {
          playback_policy: ['signed'],
          passthrough: JSON.stringify({
            productId: product.id,
            title: createProgrammeDto.title,
            type: 'programme',
          }),
        },
        cors_origin: '*',
      });

      console.log('Mux upload URL created:', upload.id);

      // Upload the file to Mux using the upload URL
      const FormData = require('form-data');
      const axios = require('axios');

      const form = new FormData();
      form.append('file', videoFile.buffer, {
        filename: videoFile.originalname,
        contentType: videoFile.mimetype,
      });

      await axios.put(upload.url, videoFile.buffer, {
        headers: {
          'Content-Type': videoFile.mimetype,
        },
      });

      console.log('Video uploaded to Mux successfully');

      // Wait a moment for Mux to process and get the asset
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get the asset information by checking the upload status
      let asset;
      let attempts = 0;
      const maxAttempts = 10;

      while (!asset && attempts < maxAttempts) {
        try {
          const uploadStatus = await this.muxClient.video.uploads.retrieve(
            upload.id,
          );
          if (uploadStatus.asset_id) {
            asset = await this.muxClient.video.assets.retrieve(
              uploadStatus.asset_id,
            );
            break;
          }
        } catch (error) {
          console.log('Waiting for asset to be created...');
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      if (!asset) {
        throw new Error(
          'Asset not found after upload - Mux may still be processing',
        );
      }

      // Handle thumbnail upload if provided
      let thumbnailUrl: string | null = null;
      if (thumbnailFile) {
        try {
          const uploadResult = await this.storageService.uploadFileWithMetadata(
            thumbnailFile,
            {
              documentType: DocumentType.PROGRAMME_THUMBNAIL, // Reuse existing document type
              fileName: `programme_thumbnail_${productId}`,
              folder: 'programme-thumbnails',
            },
          );
          thumbnailUrl = uploadResult.url;
          console.log('Thumbnail uploaded successfully:', thumbnailUrl);
        } catch (error) {
          console.error('Failed to upload thumbnail:', error);
          // Don't fail the entire process if thumbnail upload fails
        }
      }

      // Update programme with Mux asset information and thumbnail
      const updatedProgramme = (
        await this.database.db
          .update(programmes)
          .set({
            muxAssetId: asset.id,
            muxPlaybackId: asset.playback_ids?.[0]?.id,
            thumbnail: thumbnailUrl,
            isPublished: createProgrammeDto.isPublished || true, // Auto-publish when video is uploaded
            updatedAt: new Date(),
          })
          .where(eq(programmes.productId, product.id))
          .returning()
      )[0];

      return ResponseDto.createSuccessResponse(
        'Programme created and video uploaded successfully',
        {
          programme: updatedProgramme,
          product: product,
          muxAssetId: asset.id,
          muxPlaybackId: asset.playback_ids?.[0]?.id,
        },
      );
    } catch (error) {
      console.error('Failed to create programme with video:', error);
      throw new BadRequestException('Failed to create programme with video');
    }
  }

  /**
   * Creates a programme draft with title and video upload
   */
  async createProgrammeDraft(
    createProgrammeDraftDto: CreateProgrammeDraftDto,
    videoFile: any,
  ): Promise<any> {
    try {
      // Generate a unique product ID for the programme
      const productId = generateId();

      // Create product first
      const product = (
        await this.database.db
          .insert(products)
          .values({
            id: productId,
            type: ProductType.PROGRAMME,
            pricingModel: PricingModel.FREE,
            price: 0,
          })
          .returning()
      )[0];

      // Create programme with minimal data (draft state)
      const programme = (
        await this.database.db
          .insert(programmes)
          .values({
            productId: product.id,
            title: createProgrammeDraftDto.title,
            description: null,
            muxAssetId: null, // Will be set after Mux upload
            muxPlaybackId: null, // Will be set after Mux upload
            isPublished: false, // Draft state
            isFeatured: false,
            requiresAccess: AccessItem.PROGRAMME_ACCESS,
            duration: 0, // Will be updated after Mux processing
            categories: [] as any,
          })
          .returning()
      )[0];

      // Upload video to Mux using direct upload
      console.log('Creating Mux upload for draft programme:', product.id);

      const upload = await this.muxClient.video.uploads.create({
        new_asset_settings: {
          playback_policy: ['signed'],
          passthrough: JSON.stringify({
            productId: product.id,
            title: createProgrammeDraftDto.title,
            type: 'programme',
          }),
        },
        cors_origin: '*',
      });

      console.log('Mux upload URL created:', upload.id);

      // Upload video to Mux
      await axios.put(upload.url, videoFile.buffer, {
        headers: {
          'Content-Type': videoFile.mimetype,
        },
      });

      console.log('Video uploaded to Mux successfully');

      // Poll for asset creation
      let asset;
      let attempts = 0;
      const maxAttempts = 10;

      while (!asset && attempts < maxAttempts) {
        try {
          const uploadStatus = await this.muxClient.video.uploads.get(upload.id);
          if (uploadStatus.asset_id) {
            asset = await this.muxClient.video.assets.retrieve(
              uploadStatus.asset_id,
            );
            break;
          }
        } catch (error) {
          console.log('Waiting for asset to be created...');
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      if (!asset) {
        throw new Error(
          'Asset not found after upload - Mux may still be processing',
        );
      }

      // Update programme with Mux asset information
      const updatedProgramme = (
        await this.database.db
          .update(programmes)
          .set({
            muxAssetId: asset.id,
            muxPlaybackId: asset.playback_ids?.[0]?.id,
            updatedAt: new Date(),
          })
          .where(eq(programmes.productId, product.id))
          .returning()
      )[0];

      return ResponseDto.createSuccessResponse(
        'Programme draft created and video uploaded successfully',
        {
          programme: updatedProgramme,
          product: product,
          muxAssetId: asset.id,
          muxPlaybackId: asset.playback_ids?.[0]?.id,
        },
      );
    } catch (error) {
      console.error('Failed to create programme draft:', error);
      throw new BadRequestException('Failed to create programme draft');
    }
  }

  /**
   * Updates programme with additional details
   */
  async updateProgrammeDetails(
    productId: string,
    updateDetailsDto: UpdateProgrammeDetailsDto,
    thumbnailFile?: any,
  ): Promise<any> {
    try {
      // Check if programme exists
      const [existingProduct, existingProgramme] = await Promise.all([
        this.database.db.select().from(products).where(eq(products.id, productId)),
        this.database.db.select().from(programmes).where(eq(programmes.productId, productId))
      ]);

      if (!existingProduct[0] || !existingProgramme[0]) {
        throw new NotFoundException('Programme not found');
      }

      // Handle thumbnail upload if provided
      let thumbnailUrl: string | null = existingProgramme[0].thumbnail;
      if (thumbnailFile) {
        try {
          const uploadResult = await this.storageService.uploadFileWithMetadata(
            thumbnailFile,
            {
              documentType: DocumentType.PROGRAMME_THUMBNAIL,
              fileName: `programme_thumbnail_${productId}`,
              folder: 'programme-thumbnails',
            },
          );
          thumbnailUrl = uploadResult.url;
          console.log('Thumbnail uploaded successfully:', thumbnailUrl);
        } catch (error) {
          console.error('Failed to upload thumbnail:', error);
          // Don't fail the entire process if thumbnail upload fails
        }
      }

      // Update programme with additional details
      const updatedProgramme = (
        await this.database.db
          .update(programmes)
          .set({
            description: updateDetailsDto.description || existingProgramme[0].description,
            categories: updateDetailsDto.categories ? (updateDetailsDto.categories as any) : existingProgramme[0].categories,
            isFeatured: updateDetailsDto.isFeatured !== undefined ? updateDetailsDto.isFeatured : existingProgramme[0].isFeatured,
            isPublished: updateDetailsDto.isPublished !== undefined ? updateDetailsDto.isPublished : existingProgramme[0].isPublished,
            thumbnail: thumbnailUrl,
            updatedAt: new Date(),
          })
          .where(eq(programmes.productId, productId))
          .returning()
      )[0];

      return ResponseDto.createSuccessResponse(
        'Programme details updated successfully',
        {
          programme: updatedProgramme,
        },
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Failed to update programme details:', error);
      throw new BadRequestException('Failed to update programme details');
    }
  }

  /**
   * Uploads a thumbnail image for a programme
   */
  async uploadProgrammeThumbnail(
    file: MulterFile,
    updateDto: UpdateProgrammeThumbnailDto,
  ) {
    try {
      // Check if the programme exists
      const existingProduct = (
        await this.database.db
          .select()
          .from(products)
          .where(eq(products.id, updateDto.productId))
      )[0];

      const existingProgramme = (
        await this.database.db
          .select()
          .from(programmes)
          .where(eq(programmes.productId, updateDto.productId))
      )[0];

      if (!existingProduct || !existingProgramme) {
        throw new NotFoundException('Programme not found');
      }

      // If programme already has a thumbnail, we could optionally delete the old one
      // For now, we'll just overwrite the URL in the database
      // In a production environment, you might want to delete the old file from storage

      // Upload thumbnail to storage service (public bucket)
      const uploadResult = await this.storageService.uploadFileWithMetadata(
        file,
        {
          documentType: DocumentType.PROGRAMME_THUMBNAIL,
          fileName: `programme-thumbnail-${updateDto.productId}`,
          folder: 'programme-thumbnails',
        },
      );

      // Update the programme with the new thumbnail URL
      const updatedProgramme = (
        await this.database.db
          .update(programmes)
          .set({ thumbnail: uploadResult.url })
          .where(eq(programmes.productId, updateDto.productId))
          .returning()
      )[0];

      return {
        message: 'Thumbnail uploaded successfully',
        thumbnail: uploadResult.url,
        programme: updatedProgramme,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Failed to upload programme thumbnail:', error);
      throw new BadRequestException('Could not upload programme thumbnail');
    }
  }

  /**
   * Removes a programme thumbnail
   */
  async removeProgrammeThumbnail(productId: string) {
    try {
      // Check if the programme exists
      const existingProduct = (
        await this.database.db
          .select()
          .from(products)
          .where(eq(products.id, productId))
      )[0];

      const existingProgramme = (
        await this.database.db
          .select()
          .from(programmes)
          .where(eq(programmes.productId, productId))
      )[0];

      if (!existingProduct || !existingProgramme) {
        throw new NotFoundException('Programme not found');
      }

      if (!existingProgramme.thumbnail) {
        throw new BadRequestException(
          'Programme does not have a thumbnail to remove',
        );
      }

      // Update the programme to remove the thumbnail URL
      const updatedProgramme = (
        await this.database.db
          .update(programmes)
          .set({ thumbnail: null })
          .where(eq(programmes.productId, productId))
          .returning()
      )[0];

      return {
        message: 'Thumbnail removed successfully',
        programme: updatedProgramme,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Failed to remove programme thumbnail:', error);
      throw new BadRequestException('Could not remove programme thumbnail');
    }
  }

  /**
   * Updates programme metadata after upload
   */
  async updateProgrammeMetadata(
    programmeId: string,
    updateDto: UpdateProgramme,
  ) {
    try {
      // Check if the programme exists
      const existingProduct = (
        await this.database.db
          .select()
          .from(products)
          .where(eq(products.id, programmeId))
      )[0];

      const existingProgramme = (
        await this.database.db
          .select()
          .from(programmes)
          .where(eq(programmes.productId, programmeId))
      )[0];

      if (!existingProduct || !existingProgramme) {
        throw new NotFoundException('Programme not found');
      }

      // Update the programme metadata
      const updatedProgramme = (
        await this.database.db
          .update(programmes)
          .set({
            description: updateDto.description ?? existingProgramme.description,
            categories: updateDto.categories
              ? (updateDto.categories as any)
              : existingProgramme.categories,
            isFeatured: updateDto.isFeatured ?? existingProgramme.isFeatured,
            isPublished: updateDto.isPublished ?? existingProgramme.isPublished,
          })
          .where(eq(programmes.productId, programmeId))
          .returning()
      )[0];

      return updatedProgramme;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Failed to update programme metadata:', error);
      throw new BadRequestException('Could not update programme metadata');
    }
  }

  /**
   * Gets a programme by product ID
   */
  async getProgrammeByProductId(productId: string) {
    const product = (
      await this.database.db
        .select()
        .from(products)
        .where(eq(products.id, productId))
    )[0];

    const programme = (
      await this.database.db
        .select()
        .from(programmes)
        .where(eq(programmes.productId, productId))
    )[0];

    if (!product || !programme) {
      throw new NotFoundException('Programme not found');
    }

    return programme;
  }

  /**
   * Gets all programmes with filtering and pagination
   */
  async getAllProgrammes(query: ProgrammeQueryDto) {
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

    const [programmeResults, total] = await Promise.all([
      this.programmeRepository.findAll(skip, limit, filters),
      this.programmeRepository.count(filters),
    ]);

    return ResponseDto.createPaginatedResponse(
      'Programmes retrieved successfully',
      programmeResults,
      {
        total,
        page,
        pageSize: limit,
      },
    );
  }

  /**
   * Gets a programme by ID with subscription-based access control and signed playback token
   */
  async getSecureProgrammeById(productId: string, user: User) {
    // Get the programme
    const product = (
      await this.database.db
        .select()
        .from(products)
        .where(eq(products.id, productId))
    )[0];

    const programme = (
      await this.database.db
        .select()
        .from(programmes)
        .where(eq(programmes.productId, productId))
    )[0];

    if (!product || !programme) {
      throw new NotFoundException('Programme not found');
    }

    // Check if programme is published
    if (!programme.isPublished) {
      throw new NotFoundException('Programme not available');
    }

    // Check if user has required access
    const hasAccess = await this.hasActiveSubscription(
      user.id,
      programme.requiresAccess,
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'You need an active subscription to access this programme. Please upgrade your plan.',
      );
    }

    // Verify programme has valid Mux data
    if (!programme.muxPlaybackId) {
      throw new BadRequestException('Programme video is not available');
    }

    // Generate signed playback token
    const signedToken = await this.generateSignedPlaybackToken(
      programme.muxPlaybackId,
      user.id,
    );

    // Return programme data with signed token
    return ResponseDto.createSuccessResponse(
      'Programme retrieved successfully',
      {
        programme: {
          ...programme,
          // Remove sensitive Mux data from response
          muxAssetId: undefined,
        },
        playback: {
          playbackId: programme.muxPlaybackId,
          signedToken,
          expiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours from now
        },
      },
    );
  }
}
