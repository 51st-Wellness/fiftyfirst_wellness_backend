import { PaymentStatus } from 'src/database/schema';

export type PaymentInitInput = {
  orderId?: string; // for store purchases
  subscriptionId?: string; // for subscription payments
  amount: number;
  currency: string;
  description?: string;
  items?: { name: string; quantity: number; unitPrice: number }[];
  userId: string;
};

export type PaymentInitResult = {
  providerRef: string; // PayPal order/transaction id
  approvalUrl?: string; // PayPal approval url for redirect
};

export type WebhookResult = {
  providerRef: string;
  status: PaymentStatus;
  raw: any;
  eventType: string;
};

export type PaymentCaptureResult = {
  status: 'PAID' | 'FAILED' | 'PENDING';
  transactionId?: string;
};

export interface PaymentProvider {
  // Initialize a payment session with the PSP
  initializePayment(input: PaymentInitInput): Promise<PaymentInitResult>;

  // Capture/confirm a previously approved payment
  capturePayment(providerRef: string): Promise<PaymentCaptureResult>;

  // Verify and parse webhook events
  verifyWebhook(headers: Record<string, string>, body: any): Promise<boolean>;

  // Parse webhook payload
  parseWebhook(body: any): WebhookResult;

  // Optional: Refund a payment
  refundPayment(
    providerRef: string,
    amount?: number,
  ): Promise<PaymentCaptureResult>;
}

export const PAYMENT_PROVIDER_TOKEN = 'PAYMENT_PROVIDER_TOKEN';
