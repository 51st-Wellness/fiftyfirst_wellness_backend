import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageConfigService } from './config/storage.config';
import { AWSS3Provider } from './providers/aws-s3.provider';

@Module({
  providers: [
    StorageService,
    StorageConfigService,
    {
      provide: 'STORAGE_PROVIDER',
      useClass: AWSS3Provider,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
