export interface UploadOptions {
  fileName?: string;
  folder?: string;
  bucket: string;
  bucketType?: 'public' | 'private';
}

export interface UploadResult {
  fileKey: string;
  url: string;
  size: number;
  mimeType: string;
  originalName: string;
  bucketType: 'public' | 'private';
  uploadedAt: Date;
}

export interface IStorageProvider {
  uploadFile(
    file: Express.Multer.File,
    options: UploadOptions
  ): Promise<UploadResult>;
  getFileUrl(
    fileKey: string,
    bucket: string,
    expiresIn?: number
  ): Promise<string>;
  deleteFile(fileKey: string, bucket: string): Promise<void>;
}
