export interface MulterFile {
  fieldname: string; // Field name in the form
  originalname: string; // Original file name
  encoding: string; // File encoding type
  mimetype: string; // File MIME type
  size: number; // File size in bytes
  destination: string; // Destination folder (if using disk storage)
  filename: string; // Saved filename (if using disk storage)
  path: string; // Full path (if using disk storage)
  buffer: Buffer; // File content (if using memory storage)
}

