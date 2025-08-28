import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { StoreRepository } from './store.repository';
import { CreateStoreItemDto } from './dto/create-store-item.dto';
import { UpdateStoreItemDto } from './dto/update-store-item.dto';
import { StoreItemQueryDto } from './dto/store-item-query.dto';
import { StorageService } from 'src/util/storage/storage.service';
import { DocumentType } from 'src/util/storage/constants';
import { StructuredLoggerService } from 'src/lib/logging';

@Injectable()
export class StoreService {
  constructor(
    private readonly storeRepository: StoreRepository,
    private readonly storageService: StorageService,
    private readonly logger: StructuredLoggerService,
  ) {}

  // Create a new store item with image upload
  async create(
    createStoreItemDto: CreateStoreItemDto,
    files?: { display?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    this.logger.log('Creating new store item', {
      name: createStoreItemDto.name,
    });

    // Prepare the data for creation
    const storeItemData: any = {
      name: createStoreItemDto.name,
      description: createStoreItemDto.description,
      price: createStoreItemDto.price,
      stock: createStoreItemDto.stock,
      isFeatured: createStoreItemDto.isFeatured || false,
      isPublished: createStoreItemDto.isPublished ?? true,
      tags: createStoreItemDto.tags || [],
      display: {},
      images: [],
    };

    // Handle display image upload
    if (files?.display && files.display.length > 0) {
      const displayFile = files.display[0];
      const displayUpload = await this.storageService.uploadFileWithMetadata(
        displayFile,
        {
          documentType: DocumentType.STORE_IMAGE,
          fileName: `store-display-${Date.now()}`,
          folder: 'store/display',
        },
      );

      storeItemData.display = {
        url: displayUpload.url,
        type: displayFile.mimetype.startsWith('image/') ? 'image' : 'video',
      };
    }

    // Handle additional images upload
    if (files?.images && files.images.length > 0) {
      const imageUrls = [];
      for (const imageFile of files.images) {
        const imageUpload = await this.storageService.uploadFileWithMetadata(
          imageFile,
          {
            documentType: DocumentType.STORE_IMAGE,
            fileName: `store-image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            folder: 'store/images',
          },
        );
        imageUrls.push(imageUpload.url);
      }
      storeItemData.images = imageUrls;
    }

    // Create the store item (this will also create the corresponding product)
    const storeItem = await this.storeRepository.create({
      ...storeItemData,
      product: {
        create: {
          type: 'STORE',
        },
      },
    });

    this.logger.log('Store item created successfully', {
      productId: storeItem.productId,
    });

    return storeItem;
  }

  // Find all store items with pagination and filters
  async findAll(query: StoreItemQueryDto) {
    const { page = 1, limit = 10, search, isFeatured, isPublished } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    if (isPublished !== undefined) {
      where.isPublished = isPublished;
    }

    // If search is provided, use search method instead
    if (search) {
      const searchResults = await this.storeRepository.search(search);
      const total = searchResults.length;
      const paginatedResults = searchResults.slice(skip, skip + limit);

      return {
        data: paginatedResults,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // Get store items with filters
    const [storeItems, total] = await Promise.all([
      this.storeRepository.findAll(skip, limit, where),
      this.storeRepository.count(where),
    ]);

    return {
      data: storeItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Find store item by ID
  async findOne(id: string) {
    const storeItem = await this.storeRepository.findById(id);
    if (!storeItem) {
      throw new NotFoundException('Store item not found');
    }
    return storeItem;
  }

  // Update store item
  async update(
    id: string,
    updateStoreItemDto: UpdateStoreItemDto,
    files?: { display?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    this.logger.log('Updating store item', { productId: id });

    // Check if store item exists
    const existingItem = await this.storeRepository.findById(id);
    if (!existingItem) {
      throw new NotFoundException('Store item not found');
    }

    // Prepare update data
    const updateData: any = { ...updateStoreItemDto };

    // Handle display image upload and deletion of old display
    if (files?.display && files.display.length > 0) {
      const displayFile = files.display[0];

      // Delete old display file if it exists
      if (existingItem.display && typeof existingItem.display === 'object') {
        const oldDisplay = existingItem.display as { url?: string };
        if (oldDisplay.url) {
          try {
            await this.deleteFileFromStorage(oldDisplay.url);
            this.logger.log('Old display file deleted from storage', {
              url: oldDisplay.url,
            });
          } catch (error) {
            this.logger.warn('Failed to delete old display file from storage', {
              url: oldDisplay.url,
              error: error.message,
            });
          }
        }
      }

      const displayUpload = await this.storageService.uploadFileWithMetadata(
        displayFile,
        {
          documentType: DocumentType.STORE_IMAGE,
          fileName: `store-display-${Date.now()}`,
          folder: 'store/display',
        },
      );

      updateData.display = {
        url: displayUpload.url,
        type: displayFile.mimetype.startsWith('image/') ? 'image' : 'video',
      };
    }

    // Handle additional images upload and deletion of old images
    if (files?.images && files.images.length > 0) {
      // Delete all existing images if we're replacing them
      const existingImages = (existingItem.images as string[]) || [];
      if (existingImages.length > 0) {
        await this.deleteMultipleFilesFromStorage(existingImages);
        this.logger.log('Old images deleted from storage', {
          count: existingImages.length,
        });
      }

      const imageUrls = [];
      for (const imageFile of files.images) {
        const imageUpload = await this.storageService.uploadFileWithMetadata(
          imageFile,
          {
            documentType: DocumentType.STORE_IMAGE,
            fileName: `store-image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            folder: 'store/images',
          },
        );
        imageUrls.push(imageUpload.url);
      }

      updateData.images = imageUrls;
    }

    // Update the store item
    const updatedItem = await this.storeRepository.update(id, updateData);

    this.logger.log('Store item updated successfully', { productId: id });

    return updatedItem;
  }

  // Delete store item
  async remove(id: string) {
    this.logger.log('Deleting store item', { productId: id });

    // Check if store item exists
    const existingItem = await this.storeRepository.findById(id);
    if (!existingItem) {
      throw new NotFoundException('Store item not found');
    }

    // Delete all associated files from storage first
    try {
      await this.deleteStoreItemFiles(existingItem);
    } catch (error) {
      this.logger.warn('Failed to delete some files from storage', {
        productId: id,
        error: error.message,
      });
      // Continue with deletion even if file deletion fails
    }

    // Delete the store item (this will also delete the corresponding product)
    const deletedItem = await this.storeRepository.delete(id);

    this.logger.log('Store item deleted successfully', { productId: id });

    return deletedItem;
  }

  // Get featured store items
  async getFeatured() {
    return this.storeRepository.findFeatured();
  }

  // Search store items
  async search(query: string) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query is required');
    }
    return this.storeRepository.search(query.trim());
  }

  // Helper method to delete a single file from storage
  private async deleteFileFromStorage(fileUrl: string): Promise<void> {
    try {
      // Extract file key from URL
      const urlParts = fileUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const folder = urlParts.slice(-2, -1)[0]; // Get the folder name
      const fileKey = `${folder}/${fileName}`;

      // For store images, they are typically stored in public bucket
      // We'll use the public bucket for deletion
      const bucketType = 'public';

      // Get the actual bucket name from storage config
      const bucket = this.storageService['getBucketForType'](bucketType);

      await this.storageService.deleteFile(fileKey, bucket);
      this.logger.log('File deleted from storage', { fileKey, bucket });
    } catch (error) {
      this.logger.error('Failed to delete file from storage', error, {
        fileUrl,
      });
      throw error;
    }
  }

  // Helper method to delete multiple files from storage
  private async deleteMultipleFilesFromStorage(
    fileUrls: string[],
  ): Promise<void> {
    const deletePromises = fileUrls.map((url) =>
      this.deleteFileFromStorage(url),
    );
    await Promise.allSettled(deletePromises);
  }

  // Helper method to delete all files associated with a store item
  private async deleteStoreItemFiles(storeItem: any): Promise<void> {
    const deletePromises: Promise<void>[] = [];

    // Delete display file
    if (storeItem.display && typeof storeItem.display === 'object') {
      const display = storeItem.display as { url?: string };
      if (display.url) {
        deletePromises.push(this.deleteFileFromStorage(display.url));
      }
    }

    // Delete additional images
    const images = (storeItem.images as string[]) || [];
    if (images.length > 0) {
      deletePromises.push(this.deleteMultipleFilesFromStorage(images));
    }

    // Execute all deletions
    if (deletePromises.length > 0) {
      await Promise.allSettled(deletePromises);
      this.logger.log('All store item files deleted from storage', {
        productId: storeItem.productId,
        filesCount: deletePromises.length,
      });
    }
  }
}
