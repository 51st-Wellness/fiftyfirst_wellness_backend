// Royal Mail Tracking API Response Types
export interface RoyalMailTrackingResponse {
  trackingNumber: string;
  status: RoyalMailTrackingStatus;
  events: RoyalMailTrackingEvent[];
  estimatedDeliveryDate?: string;
  lastUpdate?: string;
}

export type RoyalMailTrackingStatus =
  | 'pending'
  | 'notfound'
  | 'inforeceived'
  | 'transit'
  | 'pickup'
  | 'undelivered'
  | 'delivered'
  | 'exception'
  | 'expired';

export interface RoyalMailTrackingEvent {
  timestamp: string;
  location?: string;
  description: string;
  status: RoyalMailTrackingStatus;
}

export interface RoyalMailApiError {
  code: string;
  message: string;
  details?: any;
}
