import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import Mux from '@mux/mux-node';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateProgrammeDto,
  CreateUploadUrlResponseDto,
  UpdateProgrammeMetadataDto,
  UpdateProgrammeThumbnailDto,
} from './dto/create-programme.dto';
import {
  AccessItem,
  PricingModel,
  ProductType,
  User,
  PaymentStatus,
} from '@prisma/client';
import { InputJsonValue } from '@prisma/client/runtime/library';
import { StorageService } from '../../util/storage/storage.service';
import { DocumentType } from '../../util/storage/constants';
import { ProgrammeQueryDto } from './dto/programme-query.dto';
import { ResponseDto } from '../../util/dto/response.dto';
import { ENV } from 'src/config/env.enum';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class ProgrammeService {
  private muxClient: Mux;

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private configService: ConfigService,
  ) {
    // Initialize Mux client with credentials
    const tokenId = this.configService.get(ENV.MUX_TOKEN_ID);
    const tokenSecret = this.configService.get(ENV.MUX_TOKEN_SECRET);

    console.log('Mux Token ID exists:', tokenId);
    console.log('Mux Token Secret exists:', tokenSecret);

    this.muxClient = new Mux({
      tokenId,
      tokenSecret,
    });
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
      const product = await this.prisma.product.create({
        data: {
          // id: productId,
          type: ProductType.PROGRAMME,
          pricingModel: PricingModel.SUBSCRIPTION,
          programme: {
            create: {
              title: createProgrammeDto.title,
              description: null,
              muxAssetId: uuidv4(), // Temporary done for uniqueness , will be updated via webhook
              muxPlaybackId: uuidv4(), // Temporary, will be updated via webhook
              isPublished: false,
              isFeatured: false,
              requiresAccess: AccessItem.PROGRAMME_ACCESS,
              duration: 0, // Will be updated via webhook
              tags: [],
            },
          },
        },
        include: {
          programme: true,
        },
      });

      // Create Mux direct upload URL
      console.log('Creating Mux upload URL for product:', product.id);
      const upload = await this.muxClient.video.uploads.create({
        new_asset_settings: {
          playback_policy: ['signed'],
          passthrough: JSON.stringify({
            productId: product.id,
            title: createProgrammeDto.title,
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
    file: Express.Multer.File,
    updateDto: UpdateProgrammeThumbnailDto,
  ) {
    try {
      // Check if the programme exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { id: updateDto.productId },
        include: { programme: true },
      });

      if (!existingProduct || !existingProduct.programme) {
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
      const updatedProgramme = await this.prisma.programme.update({
        where: { productId: updateDto.productId },
        data: {
          thumbnail: uploadResult.url,
        },
      });

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
      const existingProduct = await this.prisma.product.findUnique({
        where: { id: productId },
        include: { programme: true },
      });

      if (!existingProduct || !existingProduct.programme) {
        throw new NotFoundException('Programme not found');
      }

      if (!existingProduct.programme.thumbnail) {
        throw new BadRequestException(
          'Programme does not have a thumbnail to remove',
        );
      }

      // Update the programme to remove the thumbnail URL
      const updatedProgramme = await this.prisma.programme.update({
        where: { productId: productId },
        data: {
          thumbnail: null,
        },
      });

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
  async updateProgrammeMetadata(updateDto: UpdateProgrammeMetadataDto) {
    try {
      // Check if the programme exists
      const existingProduct = await this.prisma.product.findUnique({
        where: { id: updateDto.productId },
        include: { programme: true },
      });

      if (!existingProduct || !existingProduct.programme) {
        throw new NotFoundException('Programme not found');
      }

      // Update the programme metadata
      const updatedProgramme = await this.prisma.programme.update({
        where: { productId: updateDto.productId },
        data: {
          description:
            updateDto.description ?? existingProduct.programme.description,
          tags: updateDto.tags
            ? JSON.stringify(updateDto.tags)
            : (existingProduct.programme.tags as InputJsonValue),
          isFeatured:
            updateDto.isFeatured ?? existingProduct.programme.isFeatured,
        },
      });

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
      const updatedProgramme = await this.prisma.programme.update({
        where: { productId: productId },
        data: {
          muxAssetId: muxAssetId,
          muxPlaybackId: muxPlaybackId,
          isPublished: true,
          duration: duration,
        },
      });

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
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { programme: true },
    });

    if (!product || !product.programme) {
      throw new NotFoundException('Programme not found');
    }

    return product.programme;
  }

  /**
   * Gets all programmes with filtering and pagination
   */
  async getAllProgrammes(query: ProgrammeQueryDto) {
    const { page = 1, limit = 20, isPublished, isFeatured, tags } = query;
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: any = {
      type: ProductType.PROGRAMME,
    };

    // Add programme-specific filters
    if (isPublished !== undefined) {
      whereClause.programme = {
        ...whereClause.programme,
        isPublished,
      };
    }

    if (isFeatured !== undefined) {
      whereClause.programme = {
        ...whereClause.programme,
        isFeatured,
      };
    }

    // Get total count for pagination
    const total = await this.prisma.product.count({
      where: whereClause,
    });

    // Get paginated results
    const products = await this.prisma.product.findMany({
      where: whereClause,
      include: { programme: true },
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    let programmes = products.map((product) => product.programme!);

    // Filter by tags if specified (since SQLite doesn't support array_contains)
    if (tags && tags.length > 0) {
      programmes = programmes.filter((programme) => {
        if (!programme?.tags) return false;
        const programmeTags = programme.tags as string[];
        return tags.some((tag) => programmeTags.includes(tag));
      });
    }

    return ResponseDto.createPaginatedResponse(
      'Programmes retrieved successfully',
      programmes,
      {
        total: tags && tags.length > 0 ? programmes.length : total,
        page,
        pageSize: limit,
      },
    );
  }

  /**
   * Gets all published programmes (legacy method for backward compatibility)
   */
  async getAllPublishedProgrammes() {
    const products = await this.prisma.product.findMany({
      where: {
        type: ProductType.PROGRAMME,
        programme: {
          isPublished: true,
        },
      },
      include: { programme: true },
    });

    return products.map((product) => product.programme);
  }

  /**
   * Checks if user has active subscription for accessing programmes
   */
  private async hasActiveSubscription(
    userId: string,
    requiredAccess: AccessItem,
  ): Promise<boolean> {
    const now = new Date();

    // Find active subscriptions for the user
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        status: PaymentStatus.PAID,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        plan: {
          include: {
            subscriptionAccess: true,
          },
        },
      },
    });

    // Check if any active subscription provides the required access
    return activeSubscriptions.some((subscription) =>
      subscription.plan.subscriptionAccess.some(
        (access) =>
          access.accessItem === requiredAccess ||
          access.accessItem === AccessItem.ALL_ACCESS,
      ),
    );
  }

  /**
   * Generates a signed Mux playback token for secure video access
   */
  private async generateSignedPlaybackToken(
    playbackId: string,
    userId: string,
  ): Promise<string> {
    try {
      // Generate signed playback token with 5 hours expiry
      const expirationTime = Math.floor(Date.now() / 1000) + 5 * 60 * 60; // 5 hours from now

      const token = await this.muxClient.jwt.signPlaybackId(playbackId, {
        keyId: this.configService.get(ENV.MUX_SIGNING_KEY_ID),
        keySecret: this.configService.get(ENV.MUX_SIGNING_KEY_PRIVATE),
        expiration: expirationTime.toString(),
        params: {
          user_id: userId,
        },
      });

      return token;
    } catch (error) {
      console.error('Failed to generate signed playback token:', error);
      throw new BadRequestException('Failed to generate secure video token');
    }
  }

  /**
   * Gets a programme by ID with subscription-based access control and signed playback token
   */
  async getSecureProgrammeById(productId: string, user: User) {
    // Get the programme
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { programme: true },
    });

    if (!product || !product.programme) {
      throw new NotFoundException('Programme not found');
    }

    const programme = product.programme;

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
