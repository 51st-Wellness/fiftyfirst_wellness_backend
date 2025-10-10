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
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ProgrammeService } from './programme.service';
import {
  CreateProgrammeDto,
  CreateProgrammeDraftDto,
  UpdateProgrammeDetailsDto,
  UpdateProgramme,
  UpdateProgrammeThumbnailDto,
} from './dto/create-programme.dto';
import { ProgrammeQueryDto } from './dto/programme-query.dto';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { User } from 'src/database/types';
import { UserRole } from 'src/database/schema';
import { Request } from 'express';
import { ResponseDto } from 'src/util/dto/response.dto';
import { MulterFile } from '@/types';

@Controller('product/programme')
@UseGuards(RolesGuard)
export class ProgrammeController {
  constructor(private readonly programmeService: ProgrammeService) {}

  /**
   * Creates a programme draft with title and video
   */
  @Post('create-draft')
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @UseInterceptors(FileInterceptor('video'))
  @HttpCode(HttpStatus.CREATED)
  async createProgrammeDraft(
    @UploadedFile() videoFile: MulterFile,
    @Body() body: any,
  ) {
    if (!videoFile) {
      throw new BadRequestException('Video file is required');
    }

    // Validate video file
    if (videoFile.size > 500 * 1024 * 1024) {
      throw new BadRequestException('Video file too large (max 500MB)');
    }

    const createProgrammeDraftDto: CreateProgrammeDraftDto = {
      title: body.title,
    };

    return await this.programmeService.createProgrammeDraft(
      createProgrammeDraftDto,
      videoFile,
    );
  }

  /**
   * Updates programme with additional details
   */
  @Patch('update-details/:productId')
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @UseInterceptors(FileInterceptor('thumbnail'))
  @HttpCode(HttpStatus.OK)
  async updateProgrammeDetails(
    @Param('productId') productId: string,
    @UploadedFile() thumbnailFile: MulterFile,
    @Body() body: any,
  ) {
    // Handle categories array - parse JSON string if needed
    let categories: string[] = [];
    if (typeof body.categories === 'string') {
      try {
        categories = JSON.parse(body.categories);
      } catch (e) {
        categories = body.categories ? [body.categories] : [];
      }
    } else if (Array.isArray(body.categories)) {
      categories = body.categories;
    }

    const updateDetailsDto: UpdateProgrammeDetailsDto = {
      description: body.description,
      categories: categories,
      isFeatured: body.isFeatured === 'true',
      isPublished: body.isPublished === 'true',
    };

    return await this.programmeService.updateProgrammeDetails(
      productId,
      updateDetailsDto,
      thumbnailFile,
    );
  }

  /**
   * Uploads a thumbnail image for a programme
   */
  @Post('thumbnail')
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @UseInterceptors(FileInterceptor('thumbnail'))
  @HttpCode(HttpStatus.OK)
  async uploadProgrammeThumbnail(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB max
          new FileTypeValidator({ fileType: '.(jpg|jpeg|png|webp)' }),
        ],
      }),
    )
    file: MulterFile,
    @Body() updateDto: UpdateProgrammeThumbnailDto,
  ) {
    const result = await this.programmeService.uploadProgrammeThumbnail(
      file,
      updateDto,
    );
    return ResponseDto.createSuccessResponse(
      'Programme thumbnail uploaded successfully',
      result,
    );
  }

  /**
   * Removes a programme thumbnail
   */
  @Delete('thumbnail/:productId')
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @HttpCode(HttpStatus.OK)
  async removeProgrammeThumbnail(@Param('productId') productId: string) {
    const result =
      await this.programmeService.removeProgrammeThumbnail(productId);
    return ResponseDto.createSuccessResponse(
      'Programme thumbnail removed successfully',
      result,
    );
  }

  /**
   * Updates programme metadata after video upload
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @HttpCode(HttpStatus.OK)
  async updateProgrammeMetadata(
    @Param('id') programmeId: string,
    @Body() updateDto: UpdateProgramme,
  ) {
    const result = await this.programmeService.updateProgrammeMetadata(
      programmeId,
      updateDto,
    );
    return ResponseDto.createSuccessResponse(
      'Programme metadata updated successfully',
      result,
    );
  }

  /**
   * Deletes a programme
   */
  @Delete(':productId')
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @HttpCode(HttpStatus.OK)
  async deleteProgramme(@Param('productId') productId: string) {
    return await this.programmeService.deleteProgramme(productId);
  }

  /**
   * Gets all programmes with filtering and pagination
   */
  @Get()
  async getAllProgrammes(@Query() query: ProgrammeQueryDto) {
    return this.programmeService.getAllProgrammes(query);
  }

  /**
   * Gets a secure programme by ID with subscription access control and signed playback token
   */
  @Get('secure/:productId')
  @UseGuards(AuthGuard('jwt'))
  async getSecureProgrammeById(
    @Param('productId') productId: string,
    @Req() req: Request,
  ) {
    const user = req.user as User;
    return this.programmeService.getSecureProgrammeById(productId, user);
  }

  /**
   * Gets a specific programme by product ID
   */
  @Get(':productId')
  async getProgrammeByProductId(@Param('productId') productId: string) {
    const result =
      await this.programmeService.getProgrammeByProductId(productId);
    return ResponseDto.createSuccessResponse(
      'Programme retrieved successfully',
      result,
    );
  }
}
