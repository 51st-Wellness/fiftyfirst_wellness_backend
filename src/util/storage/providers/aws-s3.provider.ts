import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  IStorageProvider,
  UploadOptions,
  UploadResult,
} from '../interfaces/storage.interface';

export const AWS_S3_PROVIDER = 'AWS_S3_PROVIDER';

@Injectable()
export class AWSS3Provider implements IStorageProvider {
  private s3: S3;

  constructor(private configService: ConfigService) {
    this.s3 = new S3({
      accessKeyId: configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY'),
      region: configService.get('AWS_REGION'),
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const bucket = options.bucket;
    const bucketType = options.bucketType || 'private';

    const key = options.folder
      ? `${options.folder}/${options.fileName}`
      : options.fileName;

    // Set ACL based on bucket type - public buckets get public-read, private get private
    const acl = bucketType === 'public' ? 'public-read' : 'private';

    const uploadParams: S3.PutObjectRequest = {
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: acl,
      ServerSideEncryption: 'AES256', // Encrypt at rest
      Metadata: {
        originalName: file.originalname,
        uploadedBy: 'storage-service',
        uploadedAt: new Date().toISOString(),
        bucketType: bucketType,
      },
    };

    const result = await this.s3.upload(uploadParams).promise();

    return {
      fileKey: key,
      url: result.Location,
      bucketType,
      size: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname,
      uploadedAt: new Date(),
    };
  }

  async getFileUrl(
    fileKey: string,
    bucket: string,
    expiresIn = 3600,
  ): Promise<string> {
    // Generate signed URL for the specified bucket
    return this.s3.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: fileKey,
      Expires: expiresIn,
    });
  }

  async deleteFile(fileKey: string, bucket: string): Promise<void> {
    await this.s3
      .deleteObject({
        Bucket: bucket,
        Key: fileKey,
      })
      .promise();
  }

  // Generate a unique file name with extension preserved
  generateFileName(originalName: string): string {
    const extension = originalName.split('.').pop();
    return `${uuidv4()}.${extension}`;
  }
}
