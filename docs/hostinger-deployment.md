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
corepack enable && corepack prepare pnpm@10.32.1 --activate && pnpm install --frozen-lockfile && pnpm --filter @kentslsc/database build && pnpm --filter @kentslsc/shared build && pnpm --filter @kentslsc/web build
```

Start command:

```bash
pnpm --filter @kentslsc/web start
```

Required frontend environment variables:

```env
FRONTEND_URL=https://your-frontend-domain.com
NEXT_PUBLIC_API_URL=https://your-api-domain.com
NEXT_PUBLIC_SOCKET_URL=https://your-api-domain.com
```

Notes:

- `FRONTEND_URL` is used for metadata, sitemap, robots, and canonical URLs.
- `NEXT_PUBLIC_API_URL` is used by the browser client and by server-side rewrites.
- `NEXT_PUBLIC_SOCKET_URL` is used by the forum websocket client.

## Backend API app

Use `apps/api` as the app root.

Build command:

```bash
corepack enable && corepack prepare pnpm@10.32.1 --activate && pnpm install --frozen-lockfile && pnpm --filter @kentslsc/database build && pnpm --filter @kentslsc/api build
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
REDIS_URL=redis://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
FRONTEND_URL=https://your-frontend-domain.com
```

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
```

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