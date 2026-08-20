# Database Migration Checklist

Use this checklist before applying any Prisma migration to a live environment.

## Before deployment

- [ ] Branch from a known-good application commit that matches the deployed schema.
- [ ] Write the migration with `pnpm --filter @kentslsc/database migrate:dev --name <name>` against a copy of production data.
- [ ] Review the generated SQL for destructive operations (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, etc.).
- [ ] Run `pnpm --filter @kentslsc/database build` so the Prisma Client matches the new schema.
- [ ] Run `pnpm typecheck` to confirm the application compiles against the updated client.
- [ ] Run `pnpm --filter @kentslsc/api test` and any e2e tests that touch the database.
- [ ] Run `./scripts/check-migration-compatibility.sh` against a target database to preview the migration and detect destructive changes.
- [ ] Prepare a rollback plan:
  - [ ] Identify the previous migration name.
  - [ ] Run `./scripts/rollback-migration.sh` to generate `rollback.sql`.
  - [ ] Verify the rollback SQL restores the previous schema state without data loss.
  - [ ] Confirm a database backup exists and has been tested.

## Deployment

- [ ] Put the application in maintenance mode if the migration locks tables or changes public data shapes.
- [ ] Apply the migration with `pnpm --filter @kentslsc/database migrate:deploy`.
- [ ] Do NOT use `migrate:dev` in production.
- [ ] Verify `/api/health/ready` returns `200` after the migration.
- [ ] Run a smoke test of critical user flows (login, membership purchase, webhook receive).

## After deployment

- [ ] Monitor error dashboards and webhook failure counts for 30 minutes.
- [ ] Confirm payment/subscription state is consistent with the new schema.
- [ ] If everything is stable, remove maintenance mode.
- [ ] If anything fails, follow the rollback plan and re-deploy the previous application version.

## Notes

- Migrations that add columns should always provide sensible defaults or run a data backfill migration first.
- Renaming columns/tables should be done in two releases (add new + copy data, then remove old) to maintain backwards compatibility.
- Keep migration SQL files in source control and never edit a migration that has already been applied to production.
