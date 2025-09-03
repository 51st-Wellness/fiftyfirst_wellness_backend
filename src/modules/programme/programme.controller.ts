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
import { ProgrammeService } from './programme.service';
import {
  CreateProgrammeDto,
  UpdateProgrammeMetadataDto,
  UpdateProgrammeThumbnailDto,
} from './dto/create-programme.dto';
import { ProgrammeQueryDto } from './dto/programme-query.dto';
import { RolesGuard } from '../../common/gaurds/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, User } from '@prisma/client';
import { Request } from 'express';

@Controller('programme')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProgrammeController {
  constructor(private readonly programmeService: ProgrammeService) {}

  /**
   * Creates a programme and generates Mux upload URL
   */
  @Post('create-upload-url')
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @HttpCode(HttpStatus.CREATED)
  async createProgrammeUploadUrl(
    @Body() createProgrammeDto: CreateProgrammeDto,
  ) {
    return this.programmeService.createProgrammeUploadUrl(createProgrammeDto);
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
    file: Express.Multer.File,
    @Body() updateDto: UpdateProgrammeThumbnailDto,
  ) {
    return this.programmeService.uploadProgrammeThumbnail(file, updateDto);
  }

  /**
   * Removes a programme thumbnail
   */
  @Delete('thumbnail/:productId')
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @HttpCode(HttpStatus.OK)
  async removeProgrammeThumbnail(@Param('productId') productId: string) {
    return this.programmeService.removeProgrammeThumbnail(productId);
  }

  /**
   * Updates programme metadata after video upload
   */
  @Patch('metadata')
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @HttpCode(HttpStatus.OK)
  async updateProgrammeMetadata(@Body() updateDto: UpdateProgrammeMetadataDto) {
    return this.programmeService.updateProgrammeMetadata(updateDto);
  }

  /**
   * Gets a secure programme by ID with subscription access control and signed playback token
   */
  @Get('secure/:productId')
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
    return this.programmeService.getProgrammeByProductId(productId);
  }

  /**
   * Gets all programmes with filtering and pagination
   */
  @Get()
  async getAllProgrammes(@Query() query: ProgrammeQueryDto) {
    return this.programmeService.getAllProgrammes(query);
  }
}
