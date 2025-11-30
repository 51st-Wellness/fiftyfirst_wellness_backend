import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  IStorageProvider,
  UploadOptions,
  UploadResult,
} from '../interfaces/storage.interface';
import { ENV } from 'src/config/env.enum';

@Injectable()
export class AWSS3Provider implements IStorageProvider {
  private s3: S3;

  constructor(private configService: ConfigService) {
    this.s3 = new S3({
      accessKeyId: configService.get(ENV.AWS_ACCESS_KEY_ID),
      secretAccessKey: configService.get(ENV.AWS_SECRET_ACCESS_KEY),
      region: configService.get(ENV.AWS_REGION),
      ...(configService.get(ENV.AWS_ENDPOINT) && {
        endpoint: configService.get(ENV.AWS_ENDPOINT),
        s3ForcePathStyle: true, // Required for S3-compatible services
        signatureVersion: 'v4', // Ensure compatibility
      }),
    });
  }

  async uploadFile(
    file: MulterFile,
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
      // url: result.Location,
      // tempoerary fix cause public route is unactivated
      url: await this.getPublicFileUrl(key, bucket),
      bucketType,
      size: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname,
      uploadedAt: new Date(),
    };
  }

  async getSignedFileUrl(
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

  getPublicFileUrl(fileKey: string, bucket: string): Promise<string> | string {
    const endpoint = this.configService.get(ENV.AWS_ENDPOINT);
    // Use the configured endpoint for public file URLs
    if (endpoint) {
      const endpointWithoutProtocol = endpoint
        .replace('https://', '')
        .replace('http://', '');
      // return `https://${endpointWithoutProtocol}/${bucket}/${fileKey}`;
      // temporary fix cause public bucket is private for now
      return this.getSignedFileUrl(fileKey, bucket, 3600 * 24 * 7);
    }

    // Fallback to AWS S3 format if no endpoint is configured
    const region = this.configService.get(ENV.AWS_REGION);
    return `https://${bucket}.s3.${region}.amazonaws.com/${fileKey}`;
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
