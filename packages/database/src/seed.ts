import { prisma } from './prisma.js';
import { UserRole, MembershipStatus } from '../dist/client/index.js';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/**
 * The seeded admin password used to be the literal `admin123`, committed to the
 * repo. Anyone who read the source had the admin credentials for any
 * environment that had ever been seeded.
 */
function resolveAdminPassword(): string {
  const fromEnv = process.env.ADMIN_SEED_PASSWORD;
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ADMIN_SEED_PASSWORD must be set when seeding in production. Refusing to seed a known password.'
    );
  }

  // Dev only, and printed so it is never a secret you have to guess.
  const generated = `Dev-${randomBytes(9).toString('base64url')}1`;
  console.warn(
    `\n  ADMIN_SEED_PASSWORD not set. Generated a development admin password:\n     ${generated}\n  Set ADMIN_SEED_PASSWORD to choose your own.\n`
  );
  return generated;
}

async function main() {
  // Cost 12 to match AuthService; the old cost of 10 left the most privileged
  // account with the weakest hash in the database.
  const adminPassword = await bcrypt.hash(resolveAdminPassword(), 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@kentslsc.org' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@kentslsc.org',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      // Seeded accounts are trusted; they must not be locked behind the
      // email-verification gate.
      emailVerifiedAt: new Date()
    }
  });

  const freeFeatures = [
    'DIRECTORY_READ',
    'FORUM_READ',
    'EVENTS_READ',
    'BLOG_READ',
    'FUNDRAISERS_READ',
    'FUNDRAISERS_DONATE',
    'DASHBOARD_ACCESS'
  ];

  const fullFeatures = [
    ...freeFeatures,
    'FORUM_POST',
    'TICKETS_PURCHASE',
    'MEMBER_CARD',
    'VOTING_RIGHTS',
    'DIRECTORY_LISTING',
    'DIRECTORY_PROMOTE'
  ];

  const familyFeatures = [...fullFeatures, 'DEPENDANTS', 'MEMBER_DISCOUNTS'];

  const freeType = await prisma.membershipType.upsert({
    where: { name: 'Free Membership' },
    update: { features: freeFeatures, autoActivate: true },
    create: {
      name: 'Free Membership',
      description: 'Basic community membership with limited access.',
      price: 0,
      isFree: true,
      durationMonths: 12,
      benefits: ['Access to public events', 'Newsletter'],
      features: freeFeatures,
      autoActivate: true
    }
  });

  const paidType = await prisma.membershipType.upsert({
    where: { name: 'Full Membership' },
    update: { features: fullFeatures, autoActivate: false },
    create: {
      name: 'Full Membership',
      description: 'Full member access including forum and member events.',
      price: 25,
      isFree: false,
      durationMonths: 12,
      benefits: ['Forum access', 'Member tickets', 'Voting rights'],
      features: fullFeatures,
      autoActivate: false
    }
  });

  const familyType = await prisma.membershipType.upsert({
    where: { name: 'Family Membership' },
    update: { features: familyFeatures, autoActivate: false },
    create: {
      name: 'Family Membership',
      description: 'Family membership covering spouse and children.',
      price: 50,
      isFree: false,
      durationMonths: 12,
      benefits: ['All full benefits', 'Family event discounts', 'Dependants included'],
      features: familyFeatures,
      autoActivate: false
    }
  });

  await prisma.forumCategory.upsert({
    where: { name: 'General Discussion' },
    update: {},
    create: {
      name: 'General Discussion',
      description: 'Open community discussion'
    }
  });

  const heroConfig = await prisma.heroConfig.upsert({
    where: { id: '00000000-0000-0000-0000-000000000000' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000000',
      mediaType: 'video',
      videoUrl: '/videos/kslsc-hero.webm',
      overlayStyle: 'noise',
      overlayOpacity: 75
    }
  });

  const committeeRoles = [
    { roleKey: 'president', position: 'President' },
    { roleKey: 'vicePresident', position: 'Vice President' },
    { roleKey: 'secretary', position: 'Secretary' },
    { roleKey: 'treasurer', position: 'Treasurer' },
    { roleKey: 'eventsLead', position: 'Events Lead' },
    { roleKey: 'youthCoordinator', position: 'Youth Coordinator' }
  ];

  for (const [index, role] of committeeRoles.entries()) {
    await prisma.committeeMember.upsert({
      where: { roleKey: role.roleKey },
      update: {},
      create: {
        name: 'TBC',
        position: role.position,
        roleKey: role.roleKey,
        displayOrder: index
      }
    });
  }

  console.log('Seeded:', {
    admin: admin.email,
    membershipTypes: [freeType.name, paidType.name, familyType.name],
    heroConfig: heroConfig.id,
    committeeRoles: committeeRoles.map((r) => r.roleKey)
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
