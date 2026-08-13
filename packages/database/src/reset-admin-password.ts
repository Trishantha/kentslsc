/**
 * Reset an admin user's password from the command line.
 *
 * Usage (from repo root):
 *   DATABASE_URL="..." ADMIN_EMAIL="admin@kentslsc.org" ADMIN_PASSWORD="newpassword" pnpm --filter @kentslsc/database reset:admin
 *
 * This script is intended for recovery when the seeded admin password is
 * forgotten. It does not create a new user — it only updates the password of an
 * existing account with role ADMIN.
 */

import { AuthEventType } from '../dist/client/index.js';
import bcrypt from 'bcrypt';

/**
 * CLI recovery often runs from developer machines that cannot reach Supabase's
 * direct Postgres port (5432). The transaction pooler (6543) is reachable from
 * anywhere, so fall back to it automatically when the direct URL is supplied.
 * This does not mutate the .env file — it only changes the URL in-memory for this
 * one-off run.
 */
function ensurePoolerUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  try {
    const u = new URL(url);
    if (u.port === '5432' && u.hostname.endsWith('.supabase.co')) {
      u.port = '6543';
      if (!u.searchParams.has('pgbouncer')) u.searchParams.set('pgbouncer', 'true');
      if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', '1');
      process.env.DATABASE_URL = u.toString();
    }
  } catch {
    // Leave an invalid/unparseable DATABASE_URL as-is so Prisma reports it cleanly.
  }
}

ensurePoolerUrl();
const { prisma } = await import('./prisma.js');

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: { passwordHash, passwordChangedAt: new Date() }
    }),
    prisma.authEvent.create({
      data: {
        userId: user.id,
        email: user.email,
        type: AuthEventType.PASSWORD_CHANGED,
        metadata: { source: 'reset-admin-password-cli' }
      }
    }),
    prisma.authEvent.create({
      data: {
        userId: user.id,
        email: user.email,
        type: AuthEventType.LOCKOUT_CLEARED,
        metadata: { source: 'reset-admin-password-cli', reason: 'admin-password-reset' }
      }
    })
  ]);

  console.log(`Password reset for ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
