# Hostinger Deployment Guide

This repository is a full-stack monorepo. For Hostinger, deploy the frontend and backend as two separate Node.js applications. Do not deploy the whole repo into `public_html` as a static site.

## Recommended Hostinger layout

Deploy these as separate apps or deployments:

1. Frontend: `apps/web`
2. Backend API: `apps/api`

If Hostinger only shows a Git import screen and a root directory selector, that is not enough for this app. You need the Node.js application manager so environment variables can be configured per app.

## Frontend app

Use `apps/web` as the app root.

Build command:

```bash
corepack enable && corepack prepare pnpm@11.21.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @kentslsc/database build && pnpm --filter @kentslsc/shared build && pnpm --filter @kentslsc/web build
```

Start command:

```bash
pnpm --filter @kentslsc/web start
```

Required frontend environment variables:

```env
FRONTEND_URL=https://your-frontend-domain.com
API_PROXY_TARGET=https://your-api-domain.com
NEXT_PUBLIC_SOCKET_URL=https://your-api-domain.com
```

Notes:

- `FRONTEND_URL` is used for metadata, sitemap, robots, and canonical URLs.
- `API_PROXY_TARGET` is the origin of the backend API. The Next.js frontend
  rewrites browser requests from `/api/*` to this origin so the httpOnly session
  cookies stay same-origin. Do **not** set `NEXT_PUBLIC_API_URL` on the frontend
  app; doing so would make the browser call the API directly and break
  authentication because the cookies are scoped to the frontend domain.
- `NEXT_PUBLIC_SOCKET_URL` is used by the forum websocket client.

Optional frontend environment variable:

```env
INTERNAL_API_URL=https://your-api-domain.com
```

- `INTERNAL_API_URL` is only needed when the frontend container cannot reach the
  public `API_PROXY_TARGET` origin from inside the container for server-side
  requests (e.g. protected pages checking the session). On Hostinger this can
  happen when the public API domain resolves to the outside world but the
  container cannot reach it. Set this to an origin the frontend container can
  reach directly, such as the API's internal service URL. If you are unsure,
  leave it unset and check the frontend logs for `[auth-server] Session check
  failed:` errors after logging in.

## Backend API app

Use `apps/api` as the app root.

Build command:

```bash
corepack enable && corepack prepare pnpm@11.21.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @kentslsc/database build && pnpm --filter @kentslsc/api build
```

Start command:

```bash
pnpm --filter @kentslsc/api start:prod
```

This command now applies any pending database migrations automatically before starting the API. The first deploy to a fresh database will run all migrations and create the required tables/columns (including the `consent` column on `contact_messages`).

If you need to start the API without running migrations (not recommended in production), use:

```bash
pnpm --filter @kentslsc/api start:prod:skip-migrations
```

Required backend environment variables:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
FRONTEND_URL=https://your-frontend-domain.com
```

Note: `REDIS_URL` is documented in some older deployment notes but is not currently used by this codebase.

Optional backend environment variables:

```env
OPENAI_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PUBLISHABLE_KEY=...
EMAIL_HOST=...
EMAIL_PORT=587
EMAIL_USER=...
EMAIL_PASS=...
EMAIL_FROM=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
SUPABASE_BUCKET=KentSLSC

# Emergency admin password recovery (set only when locked out, remove after login)
# ADMIN_EMERGENCY_PASSWORD=...
# ADMIN_EMERGENCY_EMAIL=admin@kentslsc.org
```

If you are locked out of the admin account, no admin account exists, or you cannot run a CLI reset, set `ADMIN_EMERGENCY_PASSWORD` in the backend environment, restart/redeploy the API, and log in with the email in `ADMIN_EMERGENCY_EMAIL` (default `admin@kentslsc.org`) and that password. The API will create the account if it is missing, or reset the password and clear lockouts if it exists. Remove the variable and change the password from the admin UI immediately after logging in.

## Why the Git import screen looked wrong

Hostinger’s Git deployment screen only selects:

- repository
- branch
- deploy directory

It does not configure runtime variables for a full Node app. If the deployment is pointed at `public_html`, Hostinger will usually serve the wrong thing for a Next.js app and can return `403`.

## Production checklist

1. Push the branch you want to deploy to GitHub.
2. Create the frontend Node app in Hostinger and point it at `apps/web`.
3. Create the backend Node app in Hostinger and point it at `apps/api`.
4. Set the frontend and backend environment variables above.
5. Verify the backend starts and applies database migrations (check the deployment logs for `Database migrations applied successfully.`).
6. Point your domain or subdomains to the frontend and API apps.

## Troubleshooting

### Contact form returns "We are unable to save your message right now" (HTTP 503)

The most common cause is a missing database migration. If the `contact_messages` table does not have the `consent` column (added in `20260813150000_add_contact_consent`), the API throws a 503 when trying to save the message.

To fix it:

1. Check that `DATABASE_URL` is set correctly in the backend environment variables.
2. Restart the backend app so the new `start:prod` command runs `prisma migrate deploy`.
3. Look for migration output in the backend logs. If you see migration errors, run the migration manually from your local machine or a shell with `DATABASE_URL` set:

   ```bash
   pnpm --filter @kentslsc/database migrate:deploy:prod
   ```

### Frontend shows a React hydration warning in the console

Browser extensions such as Grammarly can inject extra DOM nodes into form inputs and cause React hydration warnings. These usually do not prevent the form from submitting; focus on the API response (the 503 above) first.

## Suggested domain split

- Frontend: `https://your-domain.com`
- API: `https://api.your-domain.com`

This is the cleanest setup for the current codebase.