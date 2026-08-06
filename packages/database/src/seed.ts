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

  const freeType = await prisma.membershipType.upsert({
    where: { name: 'Free Membership' },
    update: {},
    create: {
      name: 'Free Membership',
      description: 'Basic community membership with limited access.',
      price: 0,
      isFree: true,
      durationMonths: 12,
      benefits: ['Access to public events', 'Newsletter']
    }
  });

  const paidType = await prisma.membershipType.upsert({
    where: { name: 'Full Membership' },
    update: {},
    create: {
      name: 'Full Membership',
      description: 'Full member access including forum and member events.',
      price: 25,
      isFree: false,
      durationMonths: 12,
      benefits: ['Forum access', 'Member tickets', 'Voting rights']
    }
  });

  const familyType = await prisma.membershipType.upsert({
    where: { name: 'Family Membership' },
    update: {},
    create: {
      name: 'Family Membership',
      description: 'Family membership covering spouse and children.',
      price: 50,
      isFree: false,
      durationMonths: 12,
      benefits: ['All full benefits', 'Family event discounts', 'Dependants included']
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

  console.log('Seeded:', { admin: admin.email, membershipTypes: [freeType.name, paidType.name, familyType.name] });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
