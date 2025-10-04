import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageConfigService } from './config/storage.config';
import { AWSS3Provider } from './providers/aws-s3.provider';
import { CloudinaryProvider } from './providers/cloudinary.provider';
import { createStorageConfig } from './config/storage.config';
import { configService } from 'src/config/config.service';

@Module({
  providers: [
    StorageService,
    StorageConfigService,
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: () => {
        const storageConfig = createStorageConfig(configService);
        return storageConfig.provider === 'cloudinary'
          ? new CloudinaryProvider(configService)
          : new AWSS3Provider(configService);
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
