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
import { StoreItem, UserRole } from '@prisma/client';
import { Auth } from 'src/common/decorators/auth.decorator';
import { PaginationResponseDto, ResponseDto } from 'src/util/dto/response.dto';

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
  ): Promise<ResponseDto<any>> {
    // Separate display and images from uploaded files
    const displayFile = files?.find((file) => file.fieldname === 'display');
    const imageFiles =
      files?.filter((file) => file.fieldname === 'images') || [];

    const fileData = {
      display: displayFile ? [displayFile] : undefined,
      images: imageFiles.length > 0 ? imageFiles : undefined,
    };

    const storeItem = await this.storeService.create(
      createStoreItemDto,
      fileData,
    );
    return ResponseDto.createSuccessResponse(
      'Store item created successfully',
      storeItem,
    );
  }

  // Get all store items (public access)
  @Get()
  async findAll(
    @Query() query: StoreItemQueryDto,
  ): Promise<PaginationResponseDto<StoreItem[]>> {
    const result = await this.storeService.findAll(query);
    return ResponseDto.createPaginatedResponse(
      'Store items retrieved successfully',
      result.data,
      {
        total: result.meta.total,
        page: result.meta.page,
        pageSize: result.meta.limit,
        totalPages: result.meta.totalPages,
      },
    );
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
  ): Promise<ResponseDto<any>> {
    // Separate display and images from uploaded files
    const displayFile = files?.find((file) => file.fieldname === 'display');
    const imageFiles =
      files?.filter((file) => file.fieldname === 'images') || [];

    const fileData = {
      display: displayFile ? [displayFile] : undefined,
      images: imageFiles.length > 0 ? imageFiles : undefined,
    };

    const updatedItem = await this.storeService.update(
      id,
      updateStoreItemDto,
      fileData,
    );
    return ResponseDto.createSuccessResponse(
      'Store item updated successfully',
      updatedItem,
    );
  }

  // Delete store item (Admin only)
  @Delete(':id')
  @Auth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string): Promise<ResponseDto<any>> {
    const deletedItem = await this.storeService.remove(id);
    return ResponseDto.createSuccessResponse(
      'Store item deleted successfully',
      deletedItem,
    );
  }
}
