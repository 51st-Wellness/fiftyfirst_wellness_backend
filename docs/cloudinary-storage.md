# Cloudinary Storage Provider

This document describes how to use the Cloudinary storage provider in the Fifty First Wellness application.

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Storage Provider Configuration
STORAGE_PROVIDER=cloudinary

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Features

The Cloudinary provider offers the following features:

- **Image Optimization**: Automatic image optimization and transformation
- **Multiple Formats**: Support for images, videos, and raw files
- **Secure URLs**: Signed URLs for private files
- **Public Access**: Direct URLs for public files
- **Folder Organization**: Organized folder structure for different document types
- **Metadata Support**: File metadata storage

## Usage

The Cloudinary provider is now the default storage provider. It automatically handles:

1. **File Upload**: Uploads files to Cloudinary with proper organization
2. **Public Files**: Direct access URLs for public files
3. **Private Files**: Signed URLs for private files with expiration
4. **File Deletion**: Secure file deletion from Cloudinary

## Document Types

The provider supports the following document types with automatic folder organization:

- `PROFILE_PICTURE` - User profile pictures (public)
- `COVER_PICTURE` - Cover images (public)
- `BLOG_IMAGE` - Blog post images (public)
- `COURSE_IMAGE` - Course images (public)
- `MATERIAL_IMAGE` - Course material images (private)
- `ADVERT_IMAGE` - Advertisement images (public)
- `GENERAL_IMAGE` - General images (private)
- `STORE_IMAGE` - Store product images (private)
- `PROGRAMME_THUMBNAIL` - Programme thumbnails (public)

## Migration from AWS S3

To migrate from AWS S3 to Cloudinary:

1. Set up your Cloudinary account and get your credentials
2. Update your environment variables
3. Set `STORAGE_PROVIDER=cloudinary`
4. The application will automatically use Cloudinary for new uploads

## Benefits of Cloudinary

- **Better Performance**: Optimized image delivery with CDN
- **Image Transformations**: On-the-fly image resizing and optimization
- **Cost Effective**: Pay-as-you-use pricing model
- **Easy Integration**: Simple API and SDK
- **Advanced Features**: Automatic format selection, responsive images, etc.

## Configuration

The provider is configured in `src/util/storage/config/storage.config.ts` and can be customized as needed.

## Error Handling

The provider includes comprehensive error handling for:

- Upload failures
- Invalid file types
- Network issues
- Authentication errors
