import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { StoreService } from './store.service';
import { CreateStoreItemDto } from './dto/create-store-item.dto';
import { UpdateStoreItemDto } from './dto/update-store-item.dto';
import { StoreItemQueryDto } from './dto/store-item-query.dto';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Auth } from 'src/common/decorators/auth.decorator';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  // Create store item (Admin only)
  @Post()
  @Auth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FilesInterceptor('files', 11)) // Allow up to 11 files (1 display + 10 images)
  async create(
    @Body() createStoreItemDto: CreateStoreItemDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({
            fileType: '.(jpg|jpeg|png|gif|webp|mp4|mov)',
          }),
        ],
        fileIsRequired: false,
      }),
    )
    files?: Express.Multer.File[],
  ) {
    // Separate display and images from uploaded files
    const displayFile = files?.find((file) => file.fieldname === 'display');
    const imageFiles =
      files?.filter((file) => file.fieldname === 'images') || [];

    const fileData = {
      display: displayFile ? [displayFile] : undefined,
      images: imageFiles.length > 0 ? imageFiles : undefined,
    };

    return this.storeService.create(createStoreItemDto, fileData);
  }

  // Get all store items (public access)
  @Get()
  async findAll(@Query() query: StoreItemQueryDto) {
    return this.storeService.findAll(query);
  }

  // Get featured store items (public access)
  @Get('featured')
  async getFeatured() {
    return this.storeService.getFeatured();
  }

  // Search store items (public access)
  @Get('search')
  async search(@Query('q') query: string) {
    return this.storeService.search(query);
  }

  // Get store item by ID (public access)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.storeService.findOne(id);
  }

  // Update store item (Admin only)
  @Patch(':id')
  @Auth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FilesInterceptor('files', 11)) // Allow up to 11 files (1 display + 10 images)
  async update(
    @Param('id') id: string,
    @Body() updateStoreItemDto: UpdateStoreItemDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({
            fileType: '.(jpg|jpeg|png|gif|webp|mp4|mov)',
          }),
        ],
        fileIsRequired: false,
      }),
    )
    files?: Express.Multer.File[],
  ) {
    // Separate display and images from uploaded files
    const displayFile = files?.find((file) => file.fieldname === 'display');
    const imageFiles =
      files?.filter((file) => file.fieldname === 'images') || [];

    const fileData = {
      display: displayFile ? [displayFile] : undefined,
      images: imageFiles.length > 0 ? imageFiles : undefined,
    };

    return this.storeService.update(id, updateStoreItemDto, fileData);
  }

  // Delete store item (Admin only)
  @Delete(':id')
  @Auth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    return this.storeService.remove(id);
  }
}
