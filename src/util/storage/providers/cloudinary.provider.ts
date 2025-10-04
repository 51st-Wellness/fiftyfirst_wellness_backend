import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import {
  IStorageProvider,
  UploadOptions,
  UploadResult,
} from '../interfaces/storage.interface';
import { ENV } from 'src/config/env.enum';

@Injectable()
export class CloudinaryProvider implements IStorageProvider {
  constructor(private configService: ConfigService) {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: configService.get(ENV.CLOUDINARY_CLOUD_NAME),
      api_key: configService.get(ENV.CLOUDINARY_API_KEY),
      api_secret: configService.get(ENV.CLOUDINARY_API_SECRET),
    });
  }

  async uploadFile(
    file: MulterFile,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const bucketType = options.bucketType || 'private';
    const folder = options.folder || 'documents';

    // Create the full path for Cloudinary
    const publicId = options.folder
      ? `${options.folder}/${options.fileName}`
      : options.fileName;

    // Remove file extension from publicId for Cloudinary
    const publicIdWithoutExt = publicId.replace(/\.[^/.]+$/, '');

    try {
      // Upload to Cloudinary
      const result = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              public_id: publicIdWithoutExt,
              folder: folder,
              resource_type: this.getResourceType(file.mimetype),
              // For public files, we don't need additional access control
              // For private files, we'll handle access through signed URLs
              access_mode: bucketType === 'public' ? 'public' : 'authenticated',
              overwrite: true,
              invalidate: true,
              // Use Cloudinary's built-in context for metadata
              context: {
                original_name: file.originalname,
                uploaded_by: 'storage-service',
                bucket_type: bucketType,
              },
              // Use tags for additional categorization
              tags: [
                'storage-service',
                bucketType,
                file.mimetype.split('/')[0],
              ],
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            },
          )
          .end(file.buffer);
      });

      return {
        fileKey: result.public_id,
        url: result.secure_url,
        bucketType,
        size: file.size,
        mimeType: file.mimetype,
        originalName: file.originalname,
        uploadedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  }

  async getSignedFileUrl(
    fileKey: string,
    bucket: string,
    expiresIn = 3600,
  ): Promise<string> {
    try {
      const cloudName = this.configService.get(ENV.CLOUDINARY_CLOUD_NAME);
      const apiSecret = this.configService.get(ENV.CLOUDINARY_API_SECRET);

      // Generate timestamp for expiration
      const timestamp = Math.round(Date.now() / 1000) + expiresIn;

      // Create the signature parameters
      const params = {
        public_id: fileKey,
        timestamp: timestamp,
      };

      // Generate signature
      const signature = cloudinary.utils.api_sign_request(params, apiSecret);

      // Construct the signed URL
      const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
      const queryParams = new URLSearchParams();
      queryParams.append('public_id', params.public_id);
      queryParams.append('timestamp', params.timestamp.toString());
      queryParams.append('signature', signature);

      return `${baseUrl}?${queryParams.toString()}`;
    } catch (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  getPublicFileUrl(fileKey: string, bucket: string): string {
    const cloudName = this.configService.get(ENV.CLOUDINARY_CLOUD_NAME);
    return `https://res.cloudinary.com/${cloudName}/image/upload/${fileKey}`;
  }

  async deleteFile(fileKey: string, bucket: string): Promise<void> {
    try {
      await new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(fileKey, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  // Generate a unique file name with extension preserved
  generateFileName(originalName: string): string {
    const extension = originalName.split('.').pop();
    return `${uuidv4()}.${extension}`;
  }

  // Determine resource type based on MIME type
  private getResourceType(
    mimeType: string,
  ): 'image' | 'video' | 'raw' | 'auto' {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (mimeType.startsWith('audio/')) {
      return 'video'; // Cloudinary treats audio as video
    } else if (mimeType === 'application/pdf') {
      return 'raw';
    } else {
      return 'raw';
    }
  }
}
