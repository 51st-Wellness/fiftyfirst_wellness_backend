import {
  Controller,
  Post,
  Body,
  Patch,
  Get,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Query,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { PodcastService } from './podcast.service';
import {
  CreatePodcastDto,
  UpdatePodcast,
  UpdatePodcastThumbnailDto,
} from './dto/create-podcast.dto';
import { PodcastQueryDto } from './dto/podcast-query.dto';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { User } from 'src/database/types';
import { UserRole } from 'src/database/schema';
import { Request } from 'express';
import { ResponseDto } from 'src/util/dto/response.dto';
import { MulterFile } from '@/types';

@Controller('product/podcast')
@UseGuards(RolesGuard)
export class PodcastController {
  constructor(private readonly podcastService: PodcastService) {}

  /**
   * Creates a podcast and generates Mux upload URL for audio
   */
  @Post('create-upload-url')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @HttpCode(HttpStatus.CREATED)
  async createPodcastUploadUrl(@Body() createPodcastDto: CreatePodcastDto) {
    const result =
      await this.podcastService.createPodcastUploadUrl(createPodcastDto);
    return ResponseDto.createSuccessResponse(
      'Podcast upload URL created successfully',
      result,
    );
  }

  /**
   * Uploads a thumbnail image for a podcast
   */
  @Post('thumbnail')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @UseInterceptors(FileInterceptor('thumbnail'))
  @HttpCode(HttpStatus.OK)
  async uploadPodcastThumbnail(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB max
          new FileTypeValidator({ fileType: '.(jpg|jpeg|png|webp)' }),
        ],
      }),
    )
    file: MulterFile,
    @Body() updateDto: UpdatePodcastThumbnailDto,
  ) {
    const result = await this.podcastService.uploadPodcastThumbnail(
      file,
      updateDto,
    );
    return ResponseDto.createSuccessResponse(
      'Podcast thumbnail uploaded successfully',
      result,
    );
  }

  /**
   * Removes a podcast thumbnail
   */
  @Delete('thumbnail/:productId')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @HttpCode(HttpStatus.OK)
  async removePodcastThumbnail(@Param('productId') productId: string) {
    const result = await this.podcastService.removePodcastThumbnail(productId);
    return ResponseDto.createSuccessResponse(
      'Podcast thumbnail removed successfully',
      result,
    );
  }

  /**
   * Updates podcast metadata after audio upload
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @HttpCode(HttpStatus.OK)
  async updatePodcastMetadata(
    @Param('id') podcastId: string,
    @Body() updateDto: UpdatePodcast,
  ) {
    const result = await this.podcastService.updatePodcastMetadata(
      podcastId,
      updateDto,
    );
    return ResponseDto.createSuccessResponse(
      'Podcast metadata updated successfully',
      result,
    );
  }

  /**
   * Gets a secure podcast by ID with subscription access control and signed playback token
   */
  @Get('secure/:productId')
  async getSecurePodcastById(
    @Param('productId') productId: string,
    @Req() req: Request,
  ) {
    const user = req.user as User;
    return this.podcastService.getSecurePodcastById(productId, user);
  }

  /**
   * Gets a specific podcast by product ID
   */
  @Get(':productId')
  async getPodcastByProductId(@Param('productId') productId: string) {
    const result = await this.podcastService.getPodcastByProductId(productId);
    return ResponseDto.createSuccessResponse(
      'Podcast retrieved successfully',
      result,
    );
  }

  /**
   * Gets all podcasts with filtering and pagination
   */
  @Get()
  async getAllPodcasts(@Query() query: PodcastQueryDto) {
    return this.podcastService.getAllPodcasts(query);
  }
}
