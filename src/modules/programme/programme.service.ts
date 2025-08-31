import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import Mux from '@mux/mux-node';
import { PrismaService } from '../../prisma/prisma.service';
import { MuxConfig } from '../../config/mux.config';
import {
  CreateProgrammeDto,
  UpdateProgrammeMetadataDto,
  CreateUploadUrlResponseDto,
} from './dto/create-programme.dto';
import { ProductType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProgrammeService {
  private muxClient: Mux;

  constructor(
    private prisma: PrismaService,
    private muxConfig: MuxConfig,
  ) {
    // Initialize Mux client with credentials
    this.muxClient = new Mux({
      tokenId: this.muxConfig.muxTokenId,
      tokenSecret: this.muxConfig.muxTokenSecret,
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
      const productId = uuidv4();

      // Create the Product and Programme entities in the database
      const product = await this.prisma.product.create({
        data: {
          id: productId,
          type: ProductType.PROGRAMME,
          programme: {
            create: {
              title: createProgrammeDto.title,
              description: null,
              muxAssetId: 'temp_asset_id', // Temporary, will be updated via webhook
              muxPlaybackId: 'temp_playback_id', // Temporary, will be updated via webhook
              isPublished: false,
              isPremium: false,
              isFeatured: false,
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
      const upload = await this.muxClient.video.uploads.create({
        new_asset_settings: {
          playback_policy: ['public'],
          passthrough: JSON.stringify({
            productId: productId,
            title: createProgrammeDto.title,
          }),
        },
        cors_origin: '*',
      });

      return {
        uploadUrl: upload.url,
        uploadId: upload.id,
        productId: productId,
      };
    } catch (error) {
      console.error('Failed to create programme upload URL:', error);
      throw new BadRequestException(
        'Could not create upload URL for programme',
      );
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
            : existingProduct.programme.tags,
          isPremium: updateDto.isPremium ?? existingProduct.programme.isPremium,
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
   * Gets all published programmes
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
}
