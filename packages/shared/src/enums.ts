export enum UserRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  BUSINESS_OWNER = 'BUSINESS_OWNER',
  GUEST = 'GUEST'
}

export enum MembershipStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

export enum TicketStatus {
  VALID = 'VALID',
  USED = 'USED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum ContactStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED'
}

export enum FundraiserStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED'
}

export enum FundraiserCategory {
  CHARITY = 'CHARITY',
  SPORTS = 'SPORTS',
  COMMUNITY = 'COMMUNITY',
  MEMORIAL = 'MEMORIAL',
  MEDICAL = 'MEDICAL',
  OTHER = 'OTHER'
}

export enum MembershipFeature {
  DIRECTORY_READ = 'DIRECTORY_READ',
  DIRECTORY_LISTING = 'DIRECTORY_LISTING',
  DIRECTORY_PROMOTE = 'DIRECTORY_PROMOTE',
  FORUM_READ = 'FORUM_READ',
  FORUM_POST = 'FORUM_POST',
  EVENTS_READ = 'EVENTS_READ',
  TICKETS_PURCHASE = 'TICKETS_PURCHASE',
  BLOG_READ = 'BLOG_READ',
  FUNDRAISERS_READ = 'FUNDRAISERS_READ',
  FUNDRAISERS_DONATE = 'FUNDRAISERS_DONATE',
  MEMBER_CARD = 'MEMBER_CARD',
  DASHBOARD_ACCESS = 'DASHBOARD_ACCESS',
  VOTING_RIGHTS = 'VOTING_RIGHTS',
  DEPENDANTS = 'DEPENDANTS',
  MEMBER_DISCOUNTS = 'MEMBER_DISCOUNTS'
}

export const membershipFeatureLabels: Record<MembershipFeature, { label: string; description: string }> = {
  [MembershipFeature.DIRECTORY_READ]: { label: 'Directory: read listings', description: 'View business directory listings.' },
  [MembershipFeature.DIRECTORY_LISTING]: { label: 'Directory: create listing', description: 'Add and manage your own business listing.' },
  [MembershipFeature.DIRECTORY_PROMOTE]: { label: 'Directory: promote listing', description: 'Pay to promote a business listing.' },
  [MembershipFeature.FORUM_READ]: { label: 'Forum: read', description: 'Read forum topics and posts.' },
  [MembershipFeature.FORUM_POST]: { label: 'Forum: post', description: 'Create topics and reply to posts.' },
  [MembershipFeature.EVENTS_READ]: { label: 'Events: view', description: 'Browse upcoming events.' },
  [MembershipFeature.TICKETS_PURCHASE]: { label: 'Events: buy tickets', description: 'Purchase tickets for events.' },
  [MembershipFeature.BLOG_READ]: { label: 'Blog: read', description: 'Read blog posts and news.' },
  [MembershipFeature.FUNDRAISERS_READ]: { label: 'Fundraisers: view', description: 'View active fundraisers.' },
  [MembershipFeature.FUNDRAISERS_DONATE]: { label: 'Fundraisers: donate', description: 'Make donations to fundraisers.' },
  [MembershipFeature.MEMBER_CARD]: { label: 'Digital membership card', description: 'Generate and download a digital membership card.' },
  [MembershipFeature.DASHBOARD_ACCESS]: { label: 'Member dashboard', description: 'Access the members-only dashboard.' },
  [MembershipFeature.VOTING_RIGHTS]: { label: 'Voting rights', description: 'Vote in club elections and decisions.' },
  [MembershipFeature.DEPENDANTS]: { label: 'Dependants included', description: 'Include spouse and children on the membership.' },
  [MembershipFeature.MEMBER_DISCOUNTS]: { label: 'Member discounts', description: 'Receive discounts on events and family activities.' }
};
