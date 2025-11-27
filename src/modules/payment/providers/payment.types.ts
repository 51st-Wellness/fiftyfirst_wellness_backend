import { PaymentStatus } from 'src/database/schema';

export type PaymentInitInput = {
  orderId?: string; // for store purchases
  subscriptionId?: string; // for subscription payments
  paymentId?: string; // internal payment identifier
  amount: number;
  currency: string;
  description?: string;
  items?: { name: string; quantity: number; unitPrice: number }[];
  userId: string;
  isPreOrder?: boolean; // Whether this is a pre-order payment
  captureMethod?: 'automatic' | 'manual'; // Capture method for Stripe
  shippingCost?: number; // Shipping cost to add as separate line item
  shippingDescription?: string; // Description for shipping line item
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
  metadata?: any;
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

  // Optional: Fetch PaymentIntent metadata (for Stripe charge events)
  fetchPaymentIntentMetadata?(
    paymentIntentId: string,
  ): Promise<Record<string, any> | null>;

  // Verify payment status directly from provider API (fallback for missed webhooks)
  verifyPaymentStatus?(providerRef: string): Promise<PaymentCaptureResult>;
}

export const PAYMENT_PROVIDER_TOKEN = 'PAYMENT_PROVIDER_TOKEN';
