# GoCardless payment provider — setup guide

GoCardless is the third supported payment provider, alongside Stripe and PayPal. It is a good fit for a UK club because it supports:

- **Direct Debit (Bacs)** — recurring membership payments collected automatically.
- **Instant Bank Pay** — open-banking bank-to-bank payments that confirm much faster than Direct Debit.
- **Instalment schedules** — split a payment (e.g. annual membership) into monthly Direct Debit instalments.

Payments are **GBP only**. GoCardless is selected either by setting `DEFAULT_PAYMENT_PROVIDER=gocardless` in the environment or from **Admin → Payments Settings**, which stores the provider and credentials in the database and overrides the env default.

## Enabling and disabling payment platforms

Each platform (Stripe/card, PayPal, GoCardless) has an on/off toggle in **Admin → Finance → Payment Settings**, under "Enabled platforms". The flags are stored in the `payment_settings` table (`stripe_enabled`, `paypal_enabled`, `gocardless_enabled`) and default to enabled.

- Turning a platform **off** hides its methods from member checkout pages and blocks new payments on it, even if its credentials are still configured. Disabling never deletes credentials.
- If the configured default provider is disabled, checkouts automatically fall back to the first enabled platform; if every platform is disabled, checkout attempts fail with a clear "No payment methods are currently available" error.
- Payments already in progress are unaffected: provider webhooks keep being verified and fulfilled while a platform is disabled, so pending payments still complete.


## 1. Create a GoCardless account

1. Sign up at https://gocardless.com and verify your email address.
2. Switch to (or create) a **SANDBOX** account — sandbox access is available from the live dashboard, or you can sign up for a dedicated sandbox account. All development and testing happens against sandbox.
3. Live collection requires completing the live account onboarding (organisation/bank details) in the GoCardless dashboard before real Direct Debits can be taken.

## 2. Get your sandbox credentials

### Access token

1. In the sandbox dashboard, go to **Developers → API access** (API tokens).
2. Click **Create access token**, give it a name, and copy the token immediately — it is shown only once.
3. This token is the `GOCARDLESS_ACCESS_TOKEN`.

### Webhook endpoint

1. In the sandbox dashboard, go to **Developers → Webhook endpoints → New endpoint**.
2. Set the URL to:

   ```
   https://<your-domain>/api/payments/gocardless/webhook
   ```

3. Subscribe to the resources the app handles: `billing_requests`, `mandates`, `payments`, `refunds`, `subscriptions`, `instalment_schedules`.
4. Copy the **webhook secret** shown for the endpoint — this is the `GOCARDLESS_WEBHOOK_SECRET`.

## 3. Environment variables

Add these to the root `.env` (and to the backend app's environment on Hostinger):

```env
GOCARDLESS_ACCESS_TOKEN=...
GOCARDLESS_WEBHOOK_SECRET=...
GOCARDLESS_ENVIRONMENT=sandbox
```

| Variable | Required | Description |
| --- | --- | --- |
| `GOCARDLESS_ACCESS_TOKEN` | Yes | Access token from the GoCardless dashboard (Developers → API access). |
| `GOCARDLESS_WEBHOOK_SECRET` | Yes | Secret of the webhook endpoint registered in the dashboard. |
| `GOCARDLESS_ENVIRONMENT` | No | `sandbox` or `live`. Defaults to `sandbox`. |
| `DEFAULT_PAYMENT_PROVIDER` | No | Set to `gocardless` to make it the default checkout provider. |

**Production startup requirement:** when `DEFAULT_PAYMENT_PROVIDER=gocardless`, the API refuses to start without both `GOCARDLESS_ACCESS_TOKEN` and `GOCARDLESS_WEBHOOK_SECRET` (enforced by the env validation at startup, same as Stripe/PayPal). The values can also be set from the admin Payments Settings page, but the env vars are the recommended source for production. Note that Hostinger does not restart the backend when you edit environment variables — redeploy or call `POST /api/admin/restart` after changing them (see `docs/hostinger-deployment.md`).

## 4. Going live

1. Complete the live account onboarding in the GoCardless dashboard (organisation and bank details). GoCardless reviews this before you can take real payments.
2. Switch the dashboard to your **live** organisation and create a **LIVE access token** (Developers → API access) and a **live webhook endpoint** pointing at the same URL as sandbox.
3. Update the environment:

   ```env
   GOCARDLESS_ACCESS_TOKEN=<live token>
   GOCARDLESS_WEBHOOK_SECRET=<live webhook secret>
   GOCARDLESS_ENVIRONMENT=live
   ```

4. Restart the API. A sandbox token used with `GOCARDLESS_ENVIRONMENT=live` (or vice versa) fails with 401s from the GoCardless API — see Troubleshooting.

## 5. Testing in sandbox

GoCardless maintains the canonical sandbox bank account details and payment behaviours. Use the **"Test your integration" / testing a Billing Request Flow** customer details documented at:

- https://developer.gocardless.com/guides/testing/billing-request-flows

These pages list the sandbox bank accounts (Bacs sort code `200000` with the documented test account numbers, e.g. the standard test account `55779911`) and how payment amounts behave in sandbox (specific amounts trigger specific outcomes). Rather than duplicating the numbers here, copy the current values from that guide — GoCardless updates them from time to time.

To test failures: the GoCardless sandbox lets you simulate failed payments, failed mandates and other outcomes per the same testing docs (typically via specific payment amounts or their failure-simulation options). A failed Direct Debit should leave the payment in a failed state and **not** activate a membership.

## 6. Operational notes

- **Direct Debit is slow.** A Bacs Direct Debit payment takes roughly **3–5 working days** to be confirmed. Memberships activate on `payments.confirmed` — i.e. when GoCardless guarantees the funds — not when the member completes the checkout flow. Tell members to expect a short delay before their membership shows as active.
- **Instant Bank Pay is fast.** Open-banking payments are confirmed much sooner (typically near-instant to a few hours), so memberships activate quickly.
- **Webhook retries.** GoCardless retries webhook deliveries that are not acknowledged. The app records every inbound event in the `webhook_events` table (deduplicated on provider + external id) and processes them through the webhook queue, so retries and out-of-order deliveries are safe.

## 7. Troubleshooting

### Where webhook events land

Every inbound GoCardless webhook is stored in the `webhook_events` table:

```sql
SELECT status, event_type, error_message, created_at
FROM webhook_events
WHERE provider = 'gocardless'
ORDER BY created_at DESC
LIMIT 50;
```

Status values: `received` (stored, not yet handled), `processed` (handled successfully), `ignored` (event type not relevant), `failed` (handler threw — see `error_message`).

Resulting payments are in the `payments` table with `payment_channel = 'gocardless'`:

```sql
SELECT id, status, amount, currency, provider_payment_id, created_at
FROM payments
WHERE payment_channel = 'gocardless'
ORDER BY created_at DESC
LIMIT 50;
```

### Common pitfalls

- **Wrong webhook secret** — signature verification fails and events are rejected before landing in the ledger. Check `GOCARDLESS_WEBHOOK_SECRET` matches the secret of the endpoint you registered (remember sandbox and live endpoints have different secrets).
- **Environment mismatch** — a sandbox access token with `GOCARDLESS_ENVIRONMENT=live` (or a live token with `sandbox`) causes 401 errors on every GoCardless API call. The token and environment must come from the same dashboard organisation.
- **Membership not activated after checkout** — this is normal for Direct Debit until `payments.confirmed` arrives (3–5 working days). Check `webhook_events` for a pending/unprocessed `payments` event rather than re-running checkout.
