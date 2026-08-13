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

import { prisma } from './prisma.js';
import bcrypt from 'bcrypt';

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
  await prisma.user.update({
    where: { email },
    data: { passwordHash }
  });

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
