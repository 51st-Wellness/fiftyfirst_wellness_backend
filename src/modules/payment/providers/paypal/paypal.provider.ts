import { Injectable } from '@nestjs/common';
import {
  PayPalApi,
  CreateOrderRequest,
  CaptureOrderRequest,
  Environment,
  LogLevel,
} from '@paypal/paypal-server-sdk';
import {
  PaymentProvider,
  PaymentInitInput,
  PaymentInitResult,
  WebhookResult,
  PaymentCaptureResult,
} from '../payment.types';

@Injectable()
export class PayPalProvider implements PaymentProvider {
  private client: PayPalApi;

  constructor(
    private clientId: string, // PayPal client ID
    private clientSecret: string, // PayPal client secret
    private mode: string, // 'sandbox' or 'live'
    private webhookId: string, // PayPal webhook ID for verification
  ) {
    // Initialize PayPal client with proper environment
    const environment =
      mode === 'live' ? Environment.Production : Environment.Sandbox;

    this.client = new PayPalApi({
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
      },
      timeout: 0,
      environment,
      logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
      },
    });
  }

  async initializePayment(input: PaymentInitInput): Promise<PaymentInitResult> {
    try {
      // Build purchase units
      const purchaseUnits = [
        {
          referenceId: input.orderId || input.subscriptionId || 'default',
          amount: {
            currencyCode: input.currency,
            value: input.amount.toFixed(2),
          },
          description: input.description?.slice(0, 127) || 'Payment',
        },
      ];

      // Create order request
      const request: CreateOrderRequest = {
        body: {
          intent: 'CAPTURE',
          purchaseUnits,
          applicationContext: {
            brandName: 'FIFTY FIRST WELLNESS',
            userAction: 'PAY_NOW',
            shippingPreference: 'NO_SHIPPING',
            returnUrl: `${process.env.FRONTEND_URL}/payment/success`,
            cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`,
          },
        },
        payPalRequestId: input.orderId || input.subscriptionId,
      };

      // Execute order creation
      const response = await this.client.ordersController.ordersCreate(request);

      if (!response.result) {
        throw new Error('Failed to create PayPal order');
      }

      // Extract approval URL
      const approvalUrl = response.result.links?.find(
        (link) => link.rel === 'approve',
      )?.href;

      return {
        providerRef: response.result.id!,
        approvalUrl,
      };
    } catch (error) {
      console.error('PayPal initializePayment error:', error);
      throw new Error(`Failed to initialize PayPal payment: ${error.message}`);
    }
  }

  async capturePayment(providerRef: string): Promise<PaymentCaptureResult> {
    try {
      // Create capture request
      const request: CaptureOrderRequest = {
        id: providerRef,
        body: {},
      };

      // Execute order capture
      const response =
        await this.client.ordersController.ordersCapture(request);

      if (!response.result) {
        return { status: 'FAILED' };
      }

      const status = response.result.status;
      const transactionId =
        response.result.purchaseUnits?.[0]?.payments?.captures?.[0]?.id;

      return {
        status: status === 'COMPLETED' ? 'PAID' : 'PENDING',
        transactionId,
      };
    } catch (error) {
      console.error('PayPal capturePayment error:', error);
      return { status: 'FAILED' };
    }
  }

  async verifyWebhook(
    headers: Record<string, string>,
    body: any,
  ): Promise<boolean> {
    try {
      // PayPal webhook verification
      const verifyRequest = {
        body: {
          authAlgo: headers['paypal-auth-algo'],
          certUrl: headers['paypal-cert-url'],
          transmissionId: headers['paypal-transmission-id'],
          transmissionSig: headers['paypal-transmission-sig'],
          transmissionTime: headers['paypal-transmission-time'],
          webhookId: this.webhookId,
          webhookEvent: body,
        },
      };

      const response =
        await this.client.webhookVerificationController.verifyWebhookSignature(
          verifyRequest,
        );

      return response.result?.verificationStatus === 'SUCCESS';
    } catch (error) {
      console.error('PayPal webhook verification error:', error);
      return false;
    }
  }

  parseWebhook(body: any): WebhookResult {
    const eventType = body.event_type;

    // Extract provider reference from different webhook event structures
    let providerRef = body.resource?.id;
    if (!providerRef && body.resource?.supplementary_data?.related_ids) {
      providerRef = body.resource.supplementary_data.related_ids.order_id;
    }

    // Map PayPal event types to our payment statuses
    let status: 'PAID' | 'FAILED' | 'PENDING' | 'CANCELLED' | 'REFUNDED' =
      'PENDING';

    switch (eventType) {
      case 'CHECKOUT.ORDER.APPROVED':
      case 'PAYMENT.CAPTURE.COMPLETED':
        status = 'PAID';
        break;
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
      case 'CHECKOUT.ORDER.VOIDED':
        status = 'FAILED';
        break;
      case 'PAYMENT.CAPTURE.REFUNDED':
        status = 'REFUNDED';
        break;
      case 'CHECKOUT.ORDER.CANCELLED':
        status = 'CANCELLED';
        break;
      default:
        status = 'PENDING';
    }

    return {
      providerRef: providerRef || 'unknown',
      status,
      raw: body,
      eventType,
    };
  }

  async refundPayment(
    providerRef: string,
    amount?: number,
  ): Promise<PaymentCaptureResult> {
    try {
      // Note: PayPal refunds are typically done against capture IDs, not order IDs
      // This is a simplified implementation - you may need to get the capture ID first
      console.log(`Refund requested for ${providerRef}, amount: ${amount}`);

      // For now, return pending status - full refund implementation would require
      // additional PayPal API calls to get capture details and process refund
      return { status: 'PENDING' };
    } catch (error) {
      console.error('PayPal refundPayment error:', error);
      return { status: 'FAILED' };
    }
  }
}
