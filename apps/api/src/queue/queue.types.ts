import type Stripe from 'stripe';

export interface SendTicketEmailJobData {
  email: string;
  eventTitle: string;
  cardUrl: string;
  tickets: { id: string; qrCodeValue: string }[];
}

export interface WebhookJobData {
  ledgerId: string;
  provider: 'stripe' | 'paypal';
  eventType: string;
  payload: Stripe.Event | Record<string, unknown>;
}
