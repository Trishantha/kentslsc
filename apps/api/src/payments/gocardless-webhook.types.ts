/**
 * Shapes of GoCardless webhook payloads.
 *
 * GoCardless delivers webhooks as batches: `{ events: [...] }` where each event
 * carries `id`, `action`, `resource_type`, `links` (ids of the affected
 * resources) and `body` (the full resource under the singular resource-type
 * key, e.g. `body.payments`). These types are intentionally looser than the
 * SDK resource types because webhook bodies expose links (such as
 * `billing_request`) that the SDK types do not declare.
 */

export interface GoCardlessPaymentResource {
  id?: string;
  /** Amount in minor units, as a string. */
  amount?: string;
  amount_refunded?: string;
  currency?: string;
  status?: string;
  charge_date?: string | null;
  created_at?: string;
  description?: string | null;
  reference?: string | null;
  metadata?: Record<string, string>;
  links?: {
    billing_request?: string;
    subscription?: string;
    instalment_schedule?: string;
    instalment?: string;
    mandate?: string;
    customer?: string;
    payout?: string;
    creditor?: string;
  };
}

export interface GoCardlessMandateResource {
  id?: string;
  status?: string;
  reference?: string | null;
  scheme?: string | null;
  created_at?: string;
  metadata?: Record<string, string>;
  links?: {
    billing_request?: string;
    customer?: string;
    customer_bank_account?: string;
    creditor?: string;
    new_mandate?: string;
  };
}

export interface GoCardlessSubscriptionResource {
  id?: string;
  status?: string;
  created_at?: string;
  metadata?: Record<string, string>;
  links?: {
    billing_request?: string;
    mandate?: string;
  };
}

export interface GoCardlessInstalmentScheduleResource {
  id?: string;
  status?: string;
  created_at?: string;
  metadata?: Record<string, string>;
  links?: {
    billing_request?: string;
    customer?: string;
    mandate?: string;
    payments?: string[];
  };
}

export interface GoCardlessRefundResource {
  id?: string;
  /** Amount in minor units, as a string. */
  amount?: string;
  status?: string;
  created_at?: string;
  reference?: string | null;
  metadata?: Record<string, string>;
  links?: {
    payment?: string;
    mandate?: string;
  };
}

export interface GoCardlessWebhookEvent {
  id: string;
  action: string;
  resource_type: string;
  links?: Record<string, string | undefined>;
  body?: {
    payments?: GoCardlessPaymentResource;
    mandates?: GoCardlessMandateResource;
    subscriptions?: GoCardlessSubscriptionResource;
    instalment_schedules?: GoCardlessInstalmentScheduleResource;
    refunds?: GoCardlessRefundResource;
  };
}

export function isGoCardlessWebhookEvent(payload: unknown): payload is GoCardlessWebhookEvent {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as GoCardlessWebhookEvent).id === 'string' &&
    typeof (payload as GoCardlessWebhookEvent).action === 'string' &&
    typeof (payload as GoCardlessWebhookEvent).resource_type === 'string'
  );
}
