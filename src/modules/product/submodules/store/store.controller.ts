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
import { UserRole } from 'src/database/schema';
import { Auth } from 'src/common/decorators/auth.decorator';
import { ResponseDto } from 'src/util/dto/response.dto';
import { CategoryExistsConstraint } from '../category/validators/category-exists.validator';
import { ProductSubscriberService } from './product-subscriber.service';
import {
  CreateProductSubscriberDto,
  UpdateProductSubscriberDto,
  ProductSubscriberQueryDto,
  BulkEmailDto,
  SingleEmailDto,
} from './dto/product-subscriber.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('product/store')
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly categoryValidator: CategoryExistsConstraint,
    private readonly productSubscriberService: ProductSubscriberService,
  ) {}

  // Create store item (Admin only)
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UsePipes(
    new ValidationPipe({
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  ) // Allow file fields for this route
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
    // Validate categories if provided

    const isValid = await this.categoryValidator.validate(
      createStoreItemDto.categories || [],
      'store',
    );
    if (!isValid) {
      throw new BadRequestException(
        CategoryExistsConstraint.defaultMessage('store'),
      );
    }

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
    console.log('query', query);
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
  @UsePipes(
    new ValidationPipe({
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )
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
    // Validate categories if provided
    if (
      updateStoreItemDto.categories &&
      updateStoreItemDto.categories.length > 0
    ) {
      const isValid = await this.categoryValidator.validate(
        updateStoreItemDto.categories,
        'store',
      );

      if (!isValid) {
        throw new BadRequestException(
          CategoryExistsConstraint.defaultMessage('store'),
        );
      }
    }

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

  // Search store items (minimal data for select dropdown)
  @Get('search/minimal')
  async searchMinimal(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ): Promise<ResponseDto<any>> {
    const results = await this.storeService.searchMinimal(
      query,
      limit ? Number(limit) : 10,
    );
    return ResponseDto.createSuccessResponse('Store items found', results);
  }

  // Subscribe to product notifications (authenticated users)
  @Post('subscribe')
  @Auth()
  async subscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProductSubscriberDto,
  ): Promise<ResponseDto<any>> {
    const subscription = await this.productSubscriberService.subscribe(
      userId,
      dto,
    );
    return ResponseDto.createSuccessResponse(
      'Successfully subscribed to product notifications',
      subscription,
    );
  }

  // Unsubscribe from product notifications (authenticated users)
  @Delete('subscribe/:productId')
  @Auth()
  async unsubscribe(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ): Promise<ResponseDto<any>> {
    await this.productSubscriberService.unsubscribe(userId, productId);
    return ResponseDto.createSuccessResponse(
      'Successfully unsubscribed from product notifications',
      null,
    );
  }

  // Check subscription status (authenticated users)
  @Get('subscribe/check/:productId')
  @Auth()
  async checkSubscription(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
  ): Promise<ResponseDto<any>> {
    const result = await this.productSubscriberService.checkSubscription(
      userId,
      productId,
    );
    return ResponseDto.createSuccessResponse('Subscription status', result);
  }

  // Get all product subscribers (Admin only)
  @Get('subscribers/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllSubscribers(
    @Query() query: ProductSubscriberQueryDto,
  ): Promise<ResponseDto<any>> {
    const result = await this.productSubscriberService.findAll(query);
    return ResponseDto.createPaginatedResponse(
      'Product subscribers retrieved successfully',
      result.items,
      result.pagination,
    );
  }

  // Get single subscriber (Admin only)
  @Get('subscribers/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getSubscriber(@Param('id') id: string): Promise<ResponseDto<any>> {
    const subscriber = await this.productSubscriberService.findOne(id);
    return ResponseDto.createSuccessResponse(
      'Subscriber retrieved successfully',
      subscriber,
    );
  }

  // Update subscriber (Admin only)
  @Put('subscribers/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateSubscriber(
    @Param('id') id: string,
    @Body() dto: UpdateProductSubscriberDto,
  ): Promise<ResponseDto<any>> {
    const updated = await this.productSubscriberService.update(id, dto);
    return ResponseDto.createSuccessResponse(
      'Subscriber updated successfully',
      updated,
    );
  }

  // Delete subscriber (Admin only)
  @Delete('subscribers/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteSubscriber(@Param('id') id: string): Promise<ResponseDto<any>> {
    await this.productSubscriberService.delete(id);
    return ResponseDto.createSuccessResponse(
      'Subscriber deleted successfully',
      null,
    );
  }

  // Send bulk email to product subscribers (Admin only)
  @Post('subscribers/bulk-email')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async sendBulkEmail(@Body() dto: BulkEmailDto): Promise<ResponseDto<any>> {
    const result = await this.productSubscriberService.sendBulkEmail(dto);
    return ResponseDto.createSuccessResponse(
      'Bulk email sent successfully',
      result,
    );
  }

  // Send email to single subscriber (Admin only)
  @Post('subscribers/single-email')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async sendSingleEmail(
    @Body() dto: SingleEmailDto,
  ): Promise<ResponseDto<any>> {
    const result = await this.productSubscriberService.sendSingleEmail(dto);
    return ResponseDto.createSuccessResponse('Email sent successfully', result);
  }
}
