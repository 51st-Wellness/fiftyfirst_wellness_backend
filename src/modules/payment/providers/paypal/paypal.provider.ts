import { Injectable } from '@nestjs/common';
import {
  Client,
  Environment,
  LogLevel,
  OrdersController,
  CheckoutPaymentIntent,
  OrderApplicationContextUserAction,
  OrderApplicationContextShippingPreference,
} from '@paypal/paypal-server-sdk';
import {
  PaymentProvider,
  PaymentInitInput,
  PaymentInitResult,
  WebhookResult,
  PaymentCaptureResult,
} from '../payment.types';
import { configService } from 'src/config/config.service';
import { ENV } from 'src/config/env.enum';
import { PaymentStatus } from 'src/database/schema';

@Injectable()
export class PayPalProvider implements PaymentProvider {
  private client: Client;

  constructor(
    private clientId: string, // PayPal client ID
    private clientSecret: string, // PayPal client secret
    private mode: 'sandbox' | 'live',
    private webhookId: string, // PayPal webhook ID for verification
  ) {
    // Initialize PayPal client with proper environment
    const environment =
      mode === 'live' ? Environment.Production : Environment.Sandbox;

    this.client = new Client({
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

      // Create order request body
      const orderRequest = {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits,
        applicationContext: {
          brandName: configService.get(ENV.APP_NAME),
          userAction: OrderApplicationContextUserAction.PayNow,
          shippingPreference:
            OrderApplicationContextShippingPreference.NoShipping,
          returnUrl: `${configService.get(ENV.FRONTEND_URL)}/payment/success`,
          cancelUrl: `${configService.get(ENV.FRONTEND_URL)}/payment/cancel`,
        },
      };

      // Execute order creation
      const ordersController = new OrdersController(this.client);
      const response = await ordersController.createOrder({
        body: orderRequest,
        paypalRequestId: input.orderId || input.subscriptionId,
      });

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
      // Execute order capture
      const ordersController = new OrdersController(this.client);
      const response = await ordersController.captureOrder({
        id: providerRef,
        body: {},
      });

      if (!response.result) {
        return { status: PaymentStatus.FAILED };
      }

      const status = response.result.status;
      const transactionId =
        response.result.purchaseUnits?.[0]?.payments?.captures?.[0]?.id;

      return {
        status:
          status === 'COMPLETED' ? PaymentStatus.PAID : PaymentStatus.PENDING,
        transactionId,
      };
    } catch (error) {
      console.error('PayPal capturePayment error:', error);
      return { status: PaymentStatus.FAILED };
    }
  }

  async verifyWebhook(
    headers: Record<string, string>,
    body: any,
  ): Promise<boolean> {
    try {
      // Manual PayPal webhook verification using REST API
      // Since the SDK doesn't include webhook verification, we'll call the API directly
      const verificationData = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.webhookId,
        webhook_event: body,
      };

      // Get access token first
      const tokenResponse = await fetch(
        `${this.mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'}/v1/oauth2/token`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en_US',
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        },
      );

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Verify webhook signature
      const verifyResponse = await fetch(
        `${this.mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'}/v1/notifications/verify-webhook-signature`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(verificationData),
        },
      );

      const verifyResult = await verifyResponse.json();
      return verifyResult.verification_status === 'SUCCESS';
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
    let status: PaymentStatus = PaymentStatus.PENDING;

    switch (eventType) {
      case 'CHECKOUT.ORDER.APPROVED':
      case 'PAYMENT.CAPTURE.COMPLETED':
        status = PaymentStatus.PAID;
        break;
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
      case 'CHECKOUT.ORDER.VOIDED':
        status = PaymentStatus.FAILED;
        break;
      case 'PAYMENT.CAPTURE.REFUNDED':
        status = PaymentStatus.REFUNDED;
        break;
      case 'CHECKOUT.ORDER.CANCELLED':
        status = PaymentStatus.CANCELLED;
        break;
      default:
        status = PaymentStatus.PENDING;
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
      return { status: PaymentStatus.PENDING };
    } catch (error) {
      console.error('PayPal refundPayment error:', error);
      return { status: PaymentStatus.FAILED };
    }
  }
}
