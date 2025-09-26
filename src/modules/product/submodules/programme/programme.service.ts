import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  CreateProgrammeDto,
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
  subscriptions,
  subscriptionPlans,
  subscriptionAccess,
} from 'src/database/schema';
import { generateId } from 'src/database/utils';
import { StorageService } from 'src/util/storage/storage.service';
import { DocumentType } from 'src/util/storage/constants';
import { ProgrammeQueryDto } from './dto/programme-query.dto';
import { ResponseDto } from 'src/util/dto/response.dto';
import { BaseProductService } from '../../services/base-product.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProgrammeService extends BaseProductService {
  constructor(
    database: DatabaseService,
    private storageService: StorageService,
    configService: any,
  ) {
    super(database, configService);
  }

  /**
   * Creates a programme entity and generates Mux upload URL
   */
  async createProgrammeUploadUrl(
    createProgrammeDto: CreateProgrammeDto,
  ): Promise<CreateUploadUrlResponseDto> {
    try {
      // Generate a unique product ID for the programme

      // Create the Product and Programme entities in the database
      const productId = generateId();

      // Create product first
      const product = (
        await this.database.db
          .insert(products)
          .values({
            id: productId,
            type: ProductType.PROGRAMME,
            pricingModel: PricingModel.SUBSCRIPTION,
          })
          .returning()
      )[0];

      // Create programme
      const programme = (
        await this.database.db
          .insert(programmes)
          .values({
            productId: product.id,
            title: createProgrammeDto.title,
            description: null,
            muxAssetId: uuidv4(), // Temporary done for uniqueness , will be updated via webhook
            muxPlaybackId: uuidv4(), // Temporary, will be updated via webhook
            isPublished: false,
            isFeatured: false,
            requiresAccess: AccessItem.PROGRAMME_ACCESS,
            duration: 0, // Will be updated via webhook
            tags: [] as any,
          })
          .returning()
      )[0];

      // Create Mux direct upload URL
      console.log('Creating Mux upload URL for product:', product.id);
      const upload = await this.muxClient.video.uploads.create({
        new_asset_settings: {
          playback_policy: ['signed'],
          passthrough: JSON.stringify({
            productId: product.id,
            title: createProgrammeDto.title,
            type: 'programme', // Mark as programme for webhook handling
          }),
        },
        cors_origin: '*',
      });
      console.log('Mux upload URL created successfully:', upload.id);

      return {
        uploadUrl: upload.url,
        uploadId: upload.id,
        productId: product.id,
      };
    } catch (error) {
      console.error('Failed to create programme upload URL:', error);
      console.error(error?.error?.messages?.toString());
      throw new BadRequestException(
        'Could not create upload URL for programme',
      );
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
            tags: updateDto.tags
              ? (updateDto.tags as any)
              : existingProgramme.tags,
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
   * Handles Mux webhook to update programme with video asset data
   */
  async handleMuxWebhook(
    muxAssetId: string,
    muxPlaybackId: string,
    passthroughData: any,
    duration: number,
  ) {
    try {
      const { productId } = passthroughData;

      // Update the programme with Mux asset information
      const updatedProgramme = (
        await this.database.db
          .update(programmes)
          .set({
            muxAssetId: muxAssetId,
            muxPlaybackId: muxPlaybackId,
            isPublished: true,
            duration: duration,
          })
          .where(eq(programmes.productId, productId))
          .returning()
      )[0];

      console.log(
        `Programme ${productId} updated with Mux asset ${muxAssetId}`,
      );
      return updatedProgramme;
    } catch (error) {
      console.error('Failed to update programme from webhook:', error);
      throw new BadRequestException(
        'Failed to process Mux webhook for programme',
      );
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
    const { page = 1, limit = 20, isPublished, isFeatured, tags } = query;
    const skip = (page - 1) * limit;

    // Build conditions for filtering
    const conditions: any[] = [eq(products.type, ProductType.PROGRAMME)];

    // Get product IDs that match programme-specific filters
    let programmeProductIds: string[] = [];

    if (isPublished !== undefined || isFeatured !== undefined) {
      const programmeConditions: any[] = [];
      if (isPublished !== undefined) {
        programmeConditions.push(eq(programmes.isPublished, isPublished));
      }
      if (isFeatured !== undefined) {
        programmeConditions.push(eq(programmes.isFeatured, isFeatured));
      }

      let programmeQuery = this.database.db
        .select({ productId: programmes.productId })
        .from(programmes)
        .$dynamic();

      if (programmeConditions.length > 0) {
        programmeQuery = programmeQuery.where(and(...programmeConditions));
      }

      const matchingProgrammes = await programmeQuery;

      programmeProductIds = matchingProgrammes.map((p) => p.productId);

      if (programmeProductIds.length === 0) {
        // No matching programmes found
        return ResponseDto.createPaginatedResponse(
          'Programmes retrieved successfully',
          [],
          { total: 0, page, pageSize: limit },
        );
      }

      if (programmeProductIds.length > 0) {
        conditions.push(
          or(...programmeProductIds.map((id) => eq(products.id, id))),
        );
      }
    }

    // Get total count for pagination
    let countQuery = this.database.db
      .select({ count: count() })
      .from(products)
      .$dynamic();

    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }

    const totalResults = await countQuery;
    const total = totalResults[0].count;

    // Get paginated results
    let productQuery = this.database.db.select().from(products).$dynamic();

    if (conditions.length > 0) {
      productQuery = productQuery.where(and(...conditions));
    }

    const productResults = await productQuery
      .orderBy(desc(products.createdAt))
      .offset(skip)
      .limit(limit);

    // Get corresponding programmes
    let programmeResults: any[] = [];
    for (const product of productResults) {
      const programme = (
        await this.database.db
          .select()
          .from(programmes)
          .where(eq(programmes.productId, product.id))
      )[0];

      if (programme) {
        programmeResults.push(programme);
      }
    }

    // Filter by tags if specified (since SQLite doesn't support array_contains)
    if (tags && tags.length > 0) {
      programmeResults = programmeResults.filter((programme) => {
        if (!programme?.tags) return false;
        const programmeTags = programme.tags as string[];
        return tags.some((tag) => programmeTags.includes(tag));
      });
    }

    return ResponseDto.createPaginatedResponse(
      'Programmes retrieved successfully',
      programmeResults,
      {
        total: tags && tags.length > 0 ? programmeResults.length : total,
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
