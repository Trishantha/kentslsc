# Hostinger Deployment Guide

This repository is a full-stack pnpm monorepo (Next.js web + NestJS API +
shared packages). Production deploys as a **single unified Node.js app**:
the root `server.js` serves the API and the Next.js web app from one
process (with the web app as a child process under lsnode — see below).
Do not deploy the whole repo into `public_html` as a static site, and do
not split the frontend/backend into two apps — that was an older layout.

## Hostinger (hbuilds) configuration

The production site runs on Hostinger's hbuilds pipeline:

- **Framework preset:** Other
- **Branch:** `main`
- **Root directory:** `/`
- **Build command:** `pnpm run build`
- **Output directory:** `.next`
- **Entry file:** `server.js`
- **Node version:** 22.x

Pushing to `main` triggers a build and deploy automatically (takes ~4–6
minutes). The unified server applies database migrations at startup, so a
fresh database is migrated automatically.

## How the unified server runs

`server.js` starts a small public HTTP proxy that routes:

- `/api/*`, `/uploads/*`, `/socket.io/*` → the NestJS API (in-process)
- `/_next/static/*` → static files served straight from the build output
- everything else → the Next.js web app

### lsnode (LiteSpeed) and the web child process

Hostinger serves Node apps through **lsnode** (LiteSpace/LiteSpeed): the
process `argv[1]` is `/usr/local/lsws/fcgi-bin/lsnode.js` and the app is
loaded in-process under lsnode's module/request shims. Under those shims,
Next 16's in-process request handler renders every dynamic app-router page
outside Next's `workStore` context and crashes with
`Invariant: Expected workStore to be initialized` (E1068) — even with no
middleware rewrite involved.

To avoid this, `server.js` detects lsnode (via `LSNODE_STARTUP_FILE` or an
`lsnode.js` argv) and runs the web app as a plain `node next start` child
process on an internal `127.0.0.1` port, proxying web traffic to it. The
API stays in-process. Outside lsnode (Docker, plain `node server.js`) the
web app runs in-process as before. Set `WEB_MODE=in-process` or
`WEB_MODE=child` to override the detection.

### Locale routing

Locale prefixes (`/en`, `/si`, `/ta`) are applied by the unified server
**before** requests reach Next.js (Accept-Language detection, default
`en`), never via a Next middleware rewrite: Next 16 resolves
origin-matching middleware rewrites inline, without entering the workStore
context, which crashes dynamic renders (vercel/next.js#91844). The app
still ships `apps/web/proxy.ts` (Next 16's replacement for `middleware.ts`)
for maintenance mode and session redirects, but it performs no rewrites for
locale routing.

## Environment variables

Set these in the Hostinger app environment (see `.env.hostinger.production`
in this repo for the production reference copy):

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
FRONTEND_URL=https://your-domain.com
NEXT_PUBLIC_FRONTEND_URL=https://your-domain.com
NEXT_PUBLIC_SOCKET_URL=https://your-domain.com

# Optional integrations
REDIS_URL=...                      # BullMQ queues for emails/webhooks
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PUBLISHABLE_KEY=...
GOCARDLESS_ACCESS_TOKEN=...
GOCARDLESS_ENVIRONMENT=...
GOCARDLESS_WEBHOOK_SECRET=...
EMAIL_HOST=...
EMAIL_PORT=587
EMAIL_USER=...
EMAIL_PASS=...
EMAIL_FROM=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
SUPABASE_BUCKET=KentSLSC
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Emergency admin password recovery (set only when locked out, remove after login)
# ADMIN_EMERGENCY_PASSWORD=...
# ADMIN_EMERGENCY_EMAIL=admin@kentslsc.org
```

Notes:

- `FRONTEND_URL` drives metadata, sitemap, robots, and canonical URLs.
- Browser requests to `/api/*` are routed to the in-process API by the
  unified proxy, so httpOnly session cookies stay same-origin. Do **not**
  set `NEXT_PUBLIC_API_URL`; that would make the browser call the API
  directly and break authentication.
- `NEXT_PUBLIC_SOCKET_URL` is used by the forum websocket client.

If you are locked out of the admin account, set `ADMIN_EMERGENCY_PASSWORD`
in the environment, restart/redeploy, and log in with the email in
`ADMIN_EMERGENCY_EMAIL` (default `admin@kentslsc.org`). The API creates or
resets the account, then remove the variable immediately.

## Restarting after environment-variable changes

Hostinger does not restart the process when you edit environment variables.
Either click **Restart** in the app panel or use the admin restart endpoint
`POST /api/admin/restart` (admin JWT required), which triggers a graceful
shutdown; the process manager starts a new process with the latest
environment.

## Troubleshooting

### Every dynamic page returns 500 with "Expected workStore to be initialized"

This is the lsnode/Next 16 interaction described above. Confirm the startup
logs show `Web mode: child` and `lsnode (LiteSpeed) runtime detected`. If
they show `Web mode: in-process` under Hostinger, the lsnode detection
failed — check that `WEB_MODE` is not forcing `in-process`.

### Deployment logs show `P3005: The database schema is not empty`

The production database contains tables but Prisma's migration history has
not been baselined. The unified server detects P3005, logs a warning, and
continues startup so the site stays online, but new migrations will not be
applied automatically until you baseline:

1. Find the first migration folder name: `ls packages/database/prisma/migrations`
2. Run against the production database:

   ```bash
   DATABASE_URL="postgresql://..." \
     pnpm --filter @kentslsc/database exec prisma migrate resolve --applied <first-migration-name>
   ```

3. Restart. As a temporary workaround you can set `SKIP_MIGRATIONS=true`,
   but future migrations will not apply automatically.

### Contact form returns "We are unable to save your message right now" (HTTP 503)

Usually a missing migration: the `contact_messages` table needs the
`consent` column (added in `20260813150000_add_contact_consent`). Check
`DATABASE_URL`, restart so migrations run, and check the logs. If needed,
run migrations manually:

```bash
DATABASE_URL="postgresql://..." pnpm --filter @kentslsc/database migrate:deploy:prod
```

### Frontend shows a React hydration warning in the console

Browser extensions such as Grammarly can inject DOM nodes into form inputs.
These usually do not block form submission; check the API response first.
