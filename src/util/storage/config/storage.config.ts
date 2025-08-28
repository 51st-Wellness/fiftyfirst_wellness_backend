import { Injectable } from '@nestjs/common';
import { ConfigService, configService } from 'src/config/config.service';
import { ENV } from '../../../config/env.enum';

export const createStorageConfig = (configService: ConfigService) => ({
  provider: configService.get(ENV.STORAGE_PROVIDER, 'aws'),
  maxFileSize: parseInt(configService.get(ENV.MAX_FILE_SIZE, '10485760')), // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  aws: {
    region: configService.get(ENV.AWS_REGION),
    publicBucket: configService.get(ENV.S3_PUBLIC_BUCKET_NAME),
    privateBucket: configService.get(ENV.S3_PRIVATE_BUCKET_NAME),
    accessKeyId: configService.get(ENV.AWS_ACCESS_KEY_ID),
    secretAccessKey: configService.get(ENV.AWS_SECRET_ACCESS_KEY),
  },
});

export const CurrentProvider = configService.get(ENV.STORAGE_PROVIDER, 'aws');
export const MaxFileSize = parseInt(
  configService.get(ENV.MAX_FILE_SIZE, '10485760'),
);
export const Providers = {
  aws: {
    region: configService.get(ENV.AWS_REGION),
    publicBucket: configService.get(ENV.S3_PUBLIC_BUCKET_NAME),
    privateBucket: configService.get(ENV.S3_PRIVATE_BUCKET_NAME),
    accessKeyId: configService.get(ENV.AWS_ACCESS_KEY_ID),
    secretAccessKey: configService.get(ENV.AWS_SECRET_ACCESS_KEY),
  },
};
console.log('providers', Providers);
const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export type StorageConfig = ReturnType<typeof createStorageConfig>;

@Injectable()
export class StorageConfigService {
  constructor(private configService: ConfigService) {}

  get config() {
    return createStorageConfig(this.configService);
  }
}
