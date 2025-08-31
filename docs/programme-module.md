# Programme Module Implementation

## Overview

The Programme module implements a complete system for creating and managing webinar programmes with integrated Mux video streaming. The implementation follows a two-stage process:

1. **Stage 1**: Programme creation with Mux upload URL generation
2. **Stage 2**: Programme metadata update after video upload completion

## Architecture

### Key Components

1. **ProgrammeService** - Core business logic for programme management
2. **ProgrammeController** - REST API endpoints for programme operations
3. **MuxWebhookController** - Handles Mux video processing webhooks
4. **MuxConfig** - Configuration service for Mux credentials
5. **DTOs** - Data transfer objects for request/response validation

## API Endpoints

### 1. Create Programme Upload URL

- **Endpoint**: `POST /programme/create-upload-url`
- **Auth**: JWT + Role (ADMIN/COACH)
- **Purpose**: Creates a programme entity and generates secure Mux upload URL

**Request Body**:

```json
{
  "title": "Advanced Wellness Workshop"
}
```

**Response**:

```json
{
  "uploadUrl": "https://storage.googleapis.com/mux-uploads/...",
  "uploadId": "upload_123456",
  "productId": "prod_uuid_12345"
}
```

**Process Flow**:

1. Generates unique `productId` (UUID)
2. Creates `Product` and `Programme` entities in database
3. Requests secure upload URL from Mux with passthrough data
4. Returns upload URL and IDs to frontend

### 2. Update Programme Metadata

- **Endpoint**: `PATCH /programme/metadata`
- **Auth**: JWT + Role (ADMIN/COACH)
- **Purpose**: Updates programme metadata after video upload

**Request Body**:

```json
{
  "productId": "prod_uuid_12345",
  "description": "Learn advanced wellness techniques...",
  "tags": ["wellness", "mindfulness", "health"],
  "isPremium": true,
  "isFeatured": false
}
```

### 3. Get Programme by Product ID

- **Endpoint**: `GET /programme/:productId`
- **Auth**: JWT + Role-based access
- **Purpose**: Retrieves specific programme details

### 4. Get All Published Programmes

- **Endpoint**: `GET /programme`
- **Auth**: JWT + Role-based access
- **Purpose**: Lists all published programmes

## Mux Integration

### Upload Flow

1. **Frontend Request**: Calls `/programme/create-upload-url`
2. **Backend Response**: Returns secure upload URL with programme data
3. **Frontend Upload**: Uses Mux Uploader to upload video directly to Mux
4. **Mux Processing**: Transcodes video and generates playback assets
5. **Webhook Notification**: Mux notifies backend when processing complete

### Webhook Handling

- **Endpoint**: `POST /webhooks/mux`
- **Security**: HMAC signature verification
- **Events Handled**:
  - `video.asset.ready` - Video processing completed successfully
  - `video.asset.errored` - Video processing failed

**Webhook Process**:

1. Validates Mux signature for security
2. Extracts `productId` from passthrough data
3. Updates programme with Mux asset ID and playback ID
4. Sets `isPublished` to `true` and updates duration

## Database Schema Integration

The implementation uses the existing Prisma schema:

```prisma
model Programme {
  productId     String  @id @unique
  title         String
  description   String?
  product       Product @relation(fields: [productId], references: [id])

  muxAssetId    String  @unique
  muxPlaybackId String  @unique
  isPublished   Boolean @default(false)
  isPremium     Boolean @default(false)
  isFeatured    Boolean @default(false)
  duration      Int     // in seconds
  tags          Json?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Mux Configuration for Video Streaming
MUX_TOKEN_ID=your_mux_token_id
MUX_TOKEN_SECRET=your_mux_token_secret
MUX_WEBHOOK_SECRET=your_mux_webhook_secret
```

### Mux Setup

1. Create Mux account and get API credentials
2. Configure webhook endpoint: `https://yourapi.com/webhooks/mux`
3. Set webhook secret in Mux dashboard
4. Update environment variables

## Security Features

1. **JWT Authentication** - All endpoints require valid JWT
2. **Role-Based Access** - ADMIN/COACH roles for programme creation
3. **Webhook Signature Verification** - HMAC validation for Mux webhooks
4. **Passthrough Data** - Secure linking of uploads to database records

## Error Handling

- **Upload URL Generation**: Handles Mux API failures gracefully
- **Webhook Processing**: Validates signatures and handles malformed data
- **Database Operations**: Comprehensive error handling with logging
- **Asset Processing**: Logs and handles video processing failures

## Frontend Integration Guide

### Upload Component Example

```javascript
import MuxUploader from '@mux/mux-uploader-react';

const ProgrammeUpload = () => {
  const getUploadUrl = async () => {
    const response = await fetch('/api/programme/create-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My Programme' }),
    });
    const data = await response.json();
    return data.uploadUrl;
  };

  return <MuxUploader endpoint={getUploadUrl} />;
};
```

### Playback Component Example

```javascript
import MuxPlayer from '@mux/mux-player-react';

const ProgrammePlayer = ({ playbackId }) => {
  return (
    <MuxPlayer
      playbackId={playbackId}
      metadata={{ video_title: 'Programme Title' }}
    />
  );
};
```

## Monitoring and Logging

- All webhook events are logged with detailed information
- Upload failures are tracked and logged
- Video processing status is monitored through webhooks
- Database operations include comprehensive error logging

## Next Steps

1. **Set up Mux account** and configure credentials
2. **Configure webhook endpoint** in Mux dashboard
3. **Test upload flow** with frontend integration
4. **Monitor webhook delivery** in Mux dashboard
5. **Implement error notification** system for failed uploads
