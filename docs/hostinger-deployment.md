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
5. Run database migrations on the production database.
6. Point your domain or subdomains to the frontend and API apps.

## Suggested domain split

- Frontend: `https://your-domain.com`
- API: `https://api.your-domain.com`

This is the cleanest setup for the current codebase.