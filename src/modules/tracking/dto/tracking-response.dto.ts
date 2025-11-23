import { RoyalMailTrackingStatus } from '../royal-mail/royal-mail.types';

export interface TrackingStatusDto {
  orderId: string;
  trackingReference: string | null;
  trackingStatus: RoyalMailTrackingStatus | null;
  trackingLastChecked: Date | null;
  trackingStatusUpdated: Date | null;
  trackingEvents: any[] | null;
  isTrackingActive: boolean;
}
