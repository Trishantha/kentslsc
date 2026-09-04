# Kent Sri Lankan Social Club – Full-Stack Platform

A futuristic, AI-driven full-stack platform for the Kent Sri Lankan Social Club.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, TailwindCSS, Framer Motion, next-themes, TanStack Query
- **Backend:** NestJS 10, TypeScript, Passport JWT, Prisma, PostgreSQL, Redis, Socket.io
- **AI:** OpenAI API (summaries, recommendations, moderation, search, welcome messages)
- **Payments:** Stripe (tickets, memberships, directory promotions, donations); GoCardless (Direct Debit / open banking, GBP — see `docs/gocardless-setup.md`)
- **QR & Cards:** qrcode, sharp (PNG generation from SVG templates)
- **Email:** Nodemailer
- **Monorepo:** pnpm workspaces + Turbo

## Project Structure

```
.
├── apps/
│   ├── api/                  # NestJS backend
│   └── web/                  # Next.js 16 frontend
├── packages/
│   ├── config/               # Tailwind preset + shared tsconfig
│   ├── database/             # Prisma schema + generated client
│   └── shared/               # Zod schemas + enums
├── docker-compose.yml        # Postgres + Redis for local dev
├── turbo.json
└── pnpm-workspace.yaml
```

## Getting Started

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` (root) and `.env.local` in `apps/web/`, then fill in real secrets.

3. **Generate Prisma client & run migrations**

   ```bash
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   ```

   Make sure `DATABASE_URL` points to your Supabase Postgres connection string
   before running these commands.

4. **Run dev servers (recommended)**

   From the project root, use Turbo to start both servers and build workspace packages first:

   ```bash
   pnpm dev
   ```

   This starts the API on port `4000` and the Next.js frontend on port `3000`, and rebuilds `@kentslsc/shared` / `@kentslsc/database` automatically when they change.

   If you prefer separate terminals, the dev scripts pin the required URLs/ports automatically, so any `PORT` or `NEXT_PUBLIC_API_URL` set in your shell is ignored:

   ```bash
   # In one terminal
   cd apps/api && pnpm dev   # API pinned to http://localhost:4000

   # In another terminal
   cd apps/web && pnpm dev   # Frontend proxies to http://localhost:4000
   ```

5. **Open**

   - Frontend: http://localhost:3000
   - API docs: http://localhost:4000/api/docs
   - Admin login: `admin@kentslsc.org` / the password from `ADMIN_SEED_PASSWORD` or the seed output

## Environment Variables

See `.env.example` for the full list. Key variables:

- `DATABASE_URL` – PostgreSQL connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` – strong random secrets
- `OPENAI_API_KEY` – OpenAI API key for AI features
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` – Stripe credentials
- `GOCARDLESS_ACCESS_TOKEN` / `GOCARDLESS_WEBHOOK_SECRET` / `GOCARDLESS_ENVIRONMENT` – GoCardless credentials (optional; see `docs/gocardless-setup.md`)
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` – SMTP settings
- `FRONTEND_URL` – URL of the Next.js app
- `NEXT_PUBLIC_API_URL` – URL of the NestJS API
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `SUPABASE_BUCKET` – optional Supabase Storage bucket for file uploads

## Available Scripts

- `pnpm dev` – start all dev servers
- `pnpm build` – build all packages/apps
- `pnpm typecheck` – typecheck all packages/apps
- `pnpm test` – run unit tests
- `pnpm test:e2e` – run end-to-end tests
- `pnpm db:studio` – open Prisma Studio

## Key Features

- **Public pages:** Home (AI recommendations), Events, Directory, Fundraising, Blog, About, Contact, Membership
- **Member features:** Forum (real-time), dashboard, QR tickets, digital membership card
- **Business directory:** free/paid listings, promoted placement, job ads
- **Admin dashboard:** full CRUD for users, memberships, events, directory, fundraisers, blog, forum moderation
- **AI:** summaries, recommendations, semantic search, forum moderation, welcome messages
- **Payments:** Stripe checkout for tickets, memberships, promotions, donations; GoCardless for Direct Debit / open banking (GBP)

## Production Notes

- Use a dedicated PostgreSQL and Redis instance.
- Set strong JWT secrets and rotate them regularly.
- Configure Stripe webhook endpoints per domain:
  - `/api/events/webhook`
  - `/api/membership/webhook`
  - `/api/fundraisers/webhook`
  - `/api/directory/webhook`
- Store generated membership cards / tickets on S3 or a persistent volume.
- Run `pnpm db:migrate:deploy` for production migrations.
