import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../..');
const databaseDir = path.join(workspaceRoot, 'packages/database');

/**
 * Resolve a safe test database URL.
 *
 * Prefers `E2E_DATABASE_URL` so CI/local runners explicitly opt a database into
 * destructive reset/seed. Falls back to `DATABASE_URL` only when its database
 * name contains `test` or `e2e` as an additional guard against wiping real data.
 */
export function requireTestDatabase(): string {
  const explicitUrl = process.env.E2E_DATABASE_URL;
  const fallbackUrl = process.env.DATABASE_URL;

  if (explicitUrl) {
    return explicitUrl;
  }

  if (!fallbackUrl) {
    throw new Error(
      'E2E smoke tests require a PostgreSQL database. ' +
        'Set E2E_DATABASE_URL to a dedicated test-only database and re-run the tests.'
    );
  }

  const parsed = new URL(fallbackUrl);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!/(test|e2e)/i.test(dbName)) {
    throw new Error(
      `Refusing to run E2E tests against database "${dbName}". ` +
        'Its name must contain "test" or "e2e", or set E2E_DATABASE_URL explicitly.'
    );
  }

  return fallbackUrl;
}

/**
 * Reset the test database with `prisma migrate reset` and seed it.
 *
 * This runs in a child process so the test database is always in a known state,
 * independent of any PrismaClient instances that may already exist in the test
 * process. It must be called before importing the API app so `DATABASE_URL` is
 * set before Prisma connects.
 */
export function resetAndSeedTestDatabase(): void {
  const databaseUrl = requireTestDatabase();

  // Force the app and any CLI commands below to target the test database.
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.ADMIN_SEED_PASSWORD = process.env.ADMIN_SEED_PASSWORD || 'E2E-Admin-Password-123';

  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const execOptions = {
    cwd: databaseDir,
    env,
    stdio: 'inherit' as const,
    timeout: 120_000
  };

  // `db push --force-reset` rebuilds the schema from scratch without relying on
  // the production migration history ordering. This keeps the E2E database in a
  // known state even when old migrations have been squashed or reordered.
  execSync(
    'pnpm exec prisma db push --force-reset --accept-data-loss --skip-generate',
    execOptions
  );

  execSync('pnpm exec tsx src/seed.ts', execOptions);
}
