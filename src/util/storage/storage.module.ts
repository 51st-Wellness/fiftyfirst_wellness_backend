import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageConfigService } from './config/storage.config';
import { AWSS3Provider } from './providers/aws-s3.provider';
import { CloudinaryProvider } from './providers/cloudinary.provider';
import { createStorageConfig } from './config/storage.config';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [
    StorageService,
    StorageConfigService,
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (configService: ConfigService) => {
        const storageConfig = createStorageConfig(configService);
        return storageConfig.provider === 'cloudinary'
          ? new CloudinaryProvider(configService)
          : new AWSS3Provider(configService);
        // return new AWSS3Provider(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
