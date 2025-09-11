import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  BadRequestException,
  UsePipes,
  ValidationPipe,
  Put,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { StoreService } from './store.service';
import { CreateStoreItemDto } from './dto/create-store-item.dto';
import { UpdateStoreItemDto } from './dto/update-store-item.dto';
import { StoreItemQueryDto } from './dto/store-item-query.dto';
import { RolesGuard } from 'src/common/gaurds/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseDto } from 'src/util/dto/response.dto';

@Controller('product/store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  // Create store item (Admin only)
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UsePipes(new ValidationPipe({ forbidNonWhitelisted: false })) // Allow file fields for this route
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'display', maxCount: 1 }, // Required display file (image or video)
      { name: 'images', maxCount: 5 }, // Optional additional images (max 5)
    ]),
  )
  async create(
    @Body() createStoreItemDto: CreateStoreItemDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          // new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          // new FileTypeValidator({
          //   fileType: '.(jpg|jpeg|png|gif|webp|mp4|mov)',
          // }),
        ],
        fileIsRequired: false,
      }),
    )
    files?: { display?: MulterFile[]; images?: MulterFile[] },
  ): Promise<ResponseDto<any>> {
    // Get display file from the files object
    const displayFile = files?.display?.[0];

    if (!displayFile) {
      throw new BadRequestException('Display file is required');
    }

    const imageFiles = files?.images || [];

    const fileData = {
      display: displayFile,
      images: imageFiles.length > 0 ? imageFiles : undefined,
    };

    console.log('creating store item', fileData);
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
  async findAll(@Query() query: StoreItemQueryDto) {
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

  // Get store item by ID (public access)
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ResponseDto<any>> {
    const storeItem = await this.storeService.findOne(id);
    return ResponseDto.createSuccessResponse(
      'Store item retrieved successfully',
      storeItem,
    );
  }
  // Update store item (Admin only)
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'display', maxCount: 1 }, // Optional display file (image or video)
      { name: 'images', maxCount: 5 }, // Optional additional images (max 5)
    ]),
  )
  async update(
    @Param('id') id: string,
    @Body() updateStoreItemDto: UpdateStoreItemDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          // new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          // new FileTypeValidator({
          //   fileType: '.(jpg|jpeg|png|gif|webp|mp4|mov)',
          // }),
        ],
        fileIsRequired: false,
      }),
    )
    files?: { display?: MulterFile[]; images?: MulterFile[] },
  ): Promise<ResponseDto<any>> {
    // Get files from the files object
    const displayFile = files?.display?.[0];
    const imageFiles = files?.images || [];

    const fileData = {
      display: displayFile,
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
