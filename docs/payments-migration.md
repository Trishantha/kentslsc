# Payments & ticketing fix — deployment and reconciliation guide

## What was fixed

1. **Tickets not issued after Stripe Checkout**
   - Checkout success URL now passes the Stripe `session_id` back to the dashboard.
   - New public endpoint `POST /tickets/confirm-payment` confirms a completed checkout and issues tickets if the webhook was missed.
   - New admin endpoint `POST /admin/events/:eventId/tickets/issue` lets admins issue tickets retroactively for a known Stripe/PayPal session.
   - `events.service.ts` now records a unified `Payment` row for every ticket purchase.

2. **Unified revenue ledger**
   - A new `Payment` model records every revenue stream: tickets, memberships, donations, directory promotions and job publishes.
   - All checkout creation paths (events, memberships, fundraising, directory) now create a `Payment` row on completion.

3. **Admin revenue reporting**
   - `GET /payments/reports/revenue` — paginated report with filters.
   - `GET /payments/reports/export` — full dataset for Excel/PDF export.
   - Admin UI at `/admin/payments/reports` with Excel and PDF export buttons.

4. **Refunds**
   - `POST /payments/:id/refund` supports full and partial refunds for Stripe, PayPal, manual, offline and free payments.
   - Fully refunded tickets are automatically cancelled.

## Deployment steps

### 1. Apply the database migration

The migration is committed as a manual SQL file because the live Supabase database is not reachable from the build environment:

```bash
packages/database/prisma/migrations/20260820071600_add_unified_payment_ledger/migration.sql
```

Run it against your target database using any PostgreSQL client (e.g. Supabase SQL Editor, `psql`):

```bash
psql "$DATABASE_URL" -f packages/database/prisma/migrations/20260820071600_add_unified_payment_ledger/migration.sql
```

Then deploy the application code.

### 2. Backfill existing records

After the migration and code are live, run the reconciliation script. It scans Stripe Checkout for completed ticket sessions that have no matching `Ticket` rows, links orphaned tickets to new `Payment` rows, and creates `Payment` rows for existing memberships, donations, directory promotions and job publishes that were created before the ledger existed.

```bash
corepack pnpm reconcile:payments
```

Flags:

- `--dry-run` — log what would be created without writing anything.
- `--from=YYYY-MM-DD` — only reconcile records/payments on or after this date.
- `--only=tickets|memberships|donations|directory|jobs` — run one source at a time.

Example dry run for the last month:

```bash
corepack pnpm reconcile:payments -- --dry-run --from=2026-07-01
```

Review the output and then remove `--dry-run` to write the records.

### 3. Issue a missing ticket manually

If a single purchase is missing a ticket:

1. Go to **Admin → Events → [event] → Tickets**.
2. Click **Issue tickets from existing payment**.
3. Enter the Stripe Checkout session ID (`cs_...`) and quantity, then submit.

The endpoint is also available as:

```bash
curl -X POST "https://api.kentslsc.co.uk/admin/events/:eventId/tickets/issue" \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"cs_...","provider":"stripe","quantity":1}'
```

## Reporting columns

The revenue report includes:

- Date
- Name
- Address (line 1, line 2, city, postcode, country)
- Contact number
- Email
- Notes
- Currency
- Gross amount
- Processing fees
- Net payment
- Refunded amount
- Payment channel (stripe, paypal, manual, offline, free)
- Payment ID / provider payment ID
- Payment date
- Payment method
- Payment status
- Source type (ticket, membership, donation, directory promotion, job publish, manual)
- Description

Exports are generated in Excel (`.xlsx`) and PDF formats.

## Refunds

From the revenue report UI, click **Refund** on any completed payment. Admins can issue a full refund or enter a partial amount and reason. Refunds call the payment provider when a provider payment ID is available; manual/offline/free payments are recorded as manual refunds only.
