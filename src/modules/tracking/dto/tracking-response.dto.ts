import { OrderStatus } from 'src/database/schema';

export interface TrackingStatusDto {
  orderId: string;
  trackingReference: string | null;
  trackingStatus: OrderStatus;
  isTrackingActive: boolean;
}
