import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { configService } from 'src/config/config.service';
import { StructuredLoggerService } from 'src/lib/logging';
import { IStorageProvider } from './interfaces/storage.interface';
import { createStorageConfig, CurrentProvider } from './config/storage.config';
import { UploadFileDto } from './dto/upload-file.dto';
import { DocumentType } from './constants';

@Injectable()
export class StorageService {
  private storageConfig = createStorageConfig(configService);

  constructor(
    @Inject('STORAGE_PROVIDER') private storageProvider: IStorageProvider,
    private logger: StructuredLoggerService,
  ) {}

  // Upload file with document type information
  async uploadFileWithMetadata(
    file: Express.Multer.File,
    uploadOptions: UploadFileDto,
  ): Promise<{
    fileKey: string;
    url: string;
    size: number;
    mimeType: string;
    originalName: string;
    bucketType: 'public' | 'private';
    documentType: DocumentType;
  }> {
    this.logger.log('Starting file upload with metadata', {
      originalName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      documentType: uploadOptions.documentType,
    });

    // Validate file
    this.validateFile(file);

    // Validate document type for image files
    this.validateDocumentTypeForFile(file, uploadOptions.documentType);

    // Generate unique file name if not provided
    const fileName =
      uploadOptions.fileName || this.generateFileName(file.originalname);

    // Create organized folder structure based on document type
    const folder = this.createFolderStructure(uploadOptions);

    // Determine bucket type based on document type
    const bucketType = this.getBucketTypeForDocument(
      uploadOptions.documentType,
    );

    // Determine bucket based on bucket type
    const bucket = this.getBucketForType(CurrentProvider, bucketType);

    try {
      // Upload to storage provider
      const uploadResult = await this.storageProvider.uploadFile(file, {
        fileName,
        folder,
        bucket,
        bucketType,
      });

      this.logger.log('File uploaded successfully with metadata', {
        fileKey: uploadResult.fileKey,
        bucketType,
        size: uploadResult.size,
        documentType: uploadOptions.documentType,
      });

      return {
        fileKey: uploadResult.fileKey,
        url: uploadResult.url,
        size: uploadResult.size,
        mimeType: uploadResult.mimeType,
        originalName: uploadResult.originalName,
        bucketType: uploadResult.bucketType,
        documentType: uploadOptions.documentType,
      };
    } catch (error) {
      this.logger.error('Failed to upload file with metadata', error, {
        originalName: file.originalname,
        bucketType,
        documentType: uploadOptions.documentType,
      });
      throw error;
    }
  }

  // Upload file with validation (legacy method)
  async uploadFile(
    file: Express.Multer.File,
    options: {
      fileName?: string;
      folder?: string;
      bucketType?: 'public' | 'private';
    } = {},
  ): Promise<{
    fileKey: string;
    url: string;
    size: number;
    mimeType: string;
    originalName: string;
    bucketType: 'public' | 'private';
  }> {
    this.logger.log('Starting file upload', {
      originalName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      bucketType: options.bucketType || 'private',
    });

    // Validate file
    this.validateFile(file);

    // Generate unique file name if not provided
    const fileName =
      options.fileName || this.generateFileName(file.originalname);

    // Always store under documents folder for organization
    const baseFolder = 'documents';
    const subFolder = options.folder || 'uploads';
    const folder = `${baseFolder}/${subFolder}`;

    const bucketType = options.bucketType || 'private';

    // Determine bucket based on bucket type
    const bucket = this.getBucketForType(CurrentProvider, bucketType);

    try {
      // Upload to storage provider
      const uploadResult = await this.storageProvider.uploadFile(file, {
        fileName,
        folder,
        bucket,
        bucketType,
      });

      this.logger.log('File uploaded successfully', {
        fileKey: uploadResult.fileKey,
        bucketType,
        size: uploadResult.size,
      });

      return {
        fileKey: uploadResult.fileKey,
        url: uploadResult.url,
        size: uploadResult.size,
        mimeType: uploadResult.mimeType,
        originalName: uploadResult.originalName,
        bucketType: uploadResult.bucketType,
      };
    } catch (error) {
      this.logger.error('Failed to upload file', error, {
        originalName: file.originalname,
        bucketType,
      });
      throw error;
    }
  }

  // Get file URL (signed for private, direct for public)
  async getFileUrl(
    fileKey: string,
    bucketType: 'public' | 'private' = 'private',
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      // Determine bucket based on bucket type
      const bucket = this.getBucketForType(CurrentProvider, bucketType);

      // For public files, return direct URL using provider-specific method
      if (bucketType === 'public') {
        const publicUrl = this.storageProvider.getPublicFileUrl(
          fileKey,
          bucket,
        );

        this.logger.log('Public file access granted', {
          fileKey,
          bucketType: 'public',
        });

        return publicUrl;
      }

      // For private files, generate signed URL
      const signedUrl = await this.storageProvider.getSignedFileUrl(
        fileKey,
        bucket,
        expiresIn,
      );

      this.logger.log('Private file access granted', {
        fileKey,
        bucketType: 'private',
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      this.logger.error('Failed to generate file URL', error, {
        fileKey,
        bucketType,
      });
      throw error;
    }
  }

  // Permanently delete file from storage
  async deleteFile(
    fileKey: string,
    bucketType: 'public' | 'private' = 'private',
  ): Promise<void> {
    try {
      // Determine bucket based on bucket type
      const bucket = this.getBucketForType(
        this.storageConfig.provider,
        bucketType,
      );

      await this.storageProvider.deleteFile(fileKey, bucket);

      this.logger.log('File deleted successfully', {
        fileKey,
        bucketType,
      });
    } catch (error) {
      this.logger.error('Failed to delete file', error, {
        fileKey,
        bucketType,
      });
      throw error;
    }
  }

  // Private helper methods
  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.storageConfig.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.storageConfig.maxFileSize} bytes`,
      );
    }

    const allowedTypes = this.storageConfig.allowedMimeTypes;
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`,
      );
    }
  }

  private generateFileName(originalName: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop();
    return `${timestamp}-${randomString}.${extension}`;
  }

  // Determine bucket based on bucket type
  public getBucketForType(
    provider: string,
    bucketType: 'public' | 'private',
  ): string {
    switch (bucketType) {
      case 'public':
        return this.storageConfig[provider].publicBucket;
      case 'private':
        return this.storageConfig[provider].privateBucket;
      default:
        return this.storageConfig[provider].publicBucket;
    }
  }

  // Validate document type for the uploaded file
  private validateDocumentTypeForFile(
    file: Express.Multer.File,
    documentType: DocumentType,
  ): void {
    const imageMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    // Check if file is an image
    const isImage = imageMimeTypes.includes(file.mimetype);

    // For now, only allow image document types
    if (!isImage) {
      throw new BadRequestException('Only image files are currently supported');
    }

    // Validate that the document type is appropriate for images
    const imageDocumentTypes = [
      DocumentType.PROFILE_PICTURE,
      DocumentType.COVER_PICTURE,
      DocumentType.BLOG_IMAGE,
      DocumentType.COURSE_IMAGE,
      DocumentType.MATERIAL_IMAGE,
      DocumentType.ADVERT_IMAGE,
      DocumentType.GENERAL_IMAGE,
    ];

    if (!imageDocumentTypes.includes(documentType)) {
      throw new BadRequestException(
        `Document type ${documentType} is not valid for image files`,
      );
    }
  }

  // Create organized folder structure based on document type
  private createFolderStructure(uploadOptions: UploadFileDto): string {
    const { documentType, folder } = uploadOptions;

    // Base folder structure: documents/{documentType}
    let folderPath = `documents/${documentType.toLowerCase()}`;

    // Add custom folder if provided
    if (folder) {
      folderPath += `/${folder}`;
    }

    return folderPath;
  }

  // Determine bucket type based on document type
  private getBucketTypeForDocument(
    documentType: DocumentType,
  ): 'public' | 'private' {
    // Profile pictures and cover pictures are typically public
    const publicDocumentTypes = [
      DocumentType.PROFILE_PICTURE,
      DocumentType.COVER_PICTURE,
      DocumentType.BLOG_IMAGE,
      DocumentType.COURSE_IMAGE,
      DocumentType.ADVERT_IMAGE,
    ];

    return publicDocumentTypes.includes(documentType) ? 'public' : 'private';
  }
}
