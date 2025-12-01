// Royal Mail Tracking API v2 Types based on official API specification

// Error Definitions
export interface RoyalMailTrackingError {
  errorCode: string;
  errorDescription: string;
  errorCause?: string;
  errorResolution?: string;
}

export interface RoyalMailTrackingErrorResponse {
  httpCode: string;
  httpMessage: string;
  moreInformation?: string;
  errors: RoyalMailTrackingError[];
}

// Summary API Types
export interface RoyalMailSummary {
  uniqueItemId?: string; // 2D barcode
  oneDBarcode?: string; // 1D barcode
  productId?: string;
  productName?: string;
  productDescription?: string;
  productCategory?: string;
  destinationCountryCode?: string;
  destinationCountryName?: string;
  originCountryCode?: string;
  originCountryName?: string;
  lastEventCode?: string;
  lastEventName?: string;
  lastEventDateTime?: string; // ISO8601
  lastEventLocationName?: string;
  statusDescription?: string;
  statusCategory?:
    | 'IN TRANSIT'
    | 'DELIVERED'
    | 'EXCEPTION'
    | 'NOT FOUND'
    | 'EXPIRED';
  statusHelpText?: string;
  summaryLine?: string;
  internationalPostalProvider?: {
    url: string;
    title: string;
    description: string;
  };
}

export interface RoyalMailSummaryMailPiece {
  mailPieceId: string;
  status: string; // HTTP status code
  carrierShortName?: string;
  carrierFullName?: string;
  summary?: RoyalMailSummary;
  error?: RoyalMailTrackingError;
}

export interface RoyalMailSummaryResponse {
  mailPieces: RoyalMailSummaryMailPiece[];
}

// Events API Types
export interface RoyalMailTrackingEvent {
  eventCode: string;
  eventName: string;
  eventDateTime: string; // ISO8601
  locationName?: string;
}

export interface RoyalMailEstimatedDelivery {
  date?: string; // ISO8601 date
  startOfEstimatedWindow?: string; // hh:mm:ss±hh:mm
  endOfEstimatedWindow?: string; // hh:mm:ss±hh:mm
}

export interface RoyalMailSignatureMetadata {
  recipientName?: string;
  signatureDateTime?: string; // ISO8601
  imageId?: string;
}

export interface RoyalMailEventsMailPiece {
  mailPieceId: string;
  carrierShortName?: string;
  carrierFullName?: string;
  summary?: RoyalMailSummary;
  signature?: RoyalMailSignatureMetadata;
  estimatedDelivery?: RoyalMailEstimatedDelivery;
  events: RoyalMailTrackingEvent[];
}

export interface RoyalMailEventsResponse {
  mailPieces: RoyalMailEventsMailPiece;
}

// Signature API Types
export interface RoyalMailSignature {
  uniqueItemId?: string; // 2D barcode
  oneDBarcode?: string; // 1D barcode
  recipientName?: string;
  signatureDateTime?: string; // ISO8601
  imageFormat?: string; // e.g., "image/svg+xml" or "image/png"
  imageId?: string;
  height?: number;
  width?: number;
  image?: string; // SVG or base64 PNG
}

export interface RoyalMailSignatureMailPiece {
  mailPieceId: string;
  carrierShortName?: string;
  carrierFullName?: string;
  signature?: RoyalMailSignature;
}

export interface RoyalMailSignatureResponse {
  mailPieces: RoyalMailSignatureMailPiece;
}

// Status Category Mapping
export type RoyalMailStatusCategory =
  | 'IN TRANSIT'
  | 'DELIVERED'
  | 'EXCEPTION'
  | 'NOT FOUND'
  | 'EXPIRED';
