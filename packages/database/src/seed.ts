import { prisma } from './prisma.js';
import { UserRole, MembershipStatus } from '../dist/client/index.js';
import bcrypt from 'bcrypt';

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@kentslsc.org' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@kentslsc.org',
      passwordHash: adminPassword,
      role: UserRole.ADMIN
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
    'VOTING_RIGHTS'
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

  console.log('Seeded:', { admin: admin.email, membershipTypes: [freeType.name, paidType.name, familyType.name], heroConfig: heroConfig.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
