import type Stripe from 'stripe';
import type { GoCardlessWebhookEvent } from '../payments/gocardless-webhook.types.js';

export interface SendTicketEmailJobData {
  email: string;
  eventTitle: string;
  cardUrl: string;
  tickets: { id: string; qrCodeValue: string }[];
}

export interface WebhookJobData {
  ledgerId: string;
  provider: 'stripe' | 'paypal' | 'gocardless';
  eventType: string;
  payload: Stripe.Event | GoCardlessWebhookEvent | Record<string, unknown>;
}
