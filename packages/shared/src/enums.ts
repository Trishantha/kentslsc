export enum UserRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  BUSINESS_OWNER = 'BUSINESS_OWNER',
  GUEST = 'GUEST'
}

/**
 * Plain string-literal form of UserRole. Roles decoded from JSON API payloads
 * arrive as plain strings, so DTOs type them with this union rather than the
 * nominal enum, while remaining comparable to 'ADMIN'-style literals.
 */
export type UserRoleValue = `${UserRole}`;

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  BANNED = 'BANNED'
}

export enum MembershipStatus {
  PENDING = 'PENDING',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
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

export enum EventCategory {
  CULTURAL = 'CULTURAL',
  SOCIAL = 'SOCIAL',
  SPORTS = 'SPORTS',
  CHARITY = 'CHARITY',
  EDUCATIONAL = 'EDUCATIONAL',
  COMMUNITY = 'COMMUNITY',
  FAMILY = 'FAMILY',
  RELIGIOUS = 'RELIGIOUS',
  FOOD = 'FOOD',
  ENTERTAINMENT = 'ENTERTAINMENT',
  BUSINESS = 'BUSINESS',
  OTHER = 'OTHER'
}

export enum EventRegistrationMode {
  TICKETED = 'TICKETED',
  ENROLLMENT = 'ENROLLMENT'
}

export const eventRegistrationModeLabels: Record<EventRegistrationMode, string> = {
  [EventRegistrationMode.TICKETED]: 'Ticketed event',
  [EventRegistrationMode.ENROLLMENT]: 'Workshop — enrollment (free)'
};

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

export enum Permission {
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_MEMBERSHIPS = 'MANAGE_MEMBERSHIPS',
  SCAN_MEMBERSHIPS = 'SCAN_MEMBERSHIPS',
  MANAGE_EVENTS = 'MANAGE_EVENTS',
  MANAGE_TICKETS = 'MANAGE_TICKETS',
  MANAGE_DIRECTORY = 'MANAGE_DIRECTORY',
  MANAGE_JOBS = 'MANAGE_JOBS',
  MANAGE_FUNDRAISERS = 'MANAGE_FUNDRAISERS',
  MANAGE_BLOG = 'MANAGE_BLOG',
  MANAGE_FORUM = 'MANAGE_FORUM',
  MANAGE_CONTACT_MESSAGES = 'MANAGE_CONTACT_MESSAGES',
  MANAGE_SITE_SETTINGS = 'MANAGE_SITE_SETTINGS',
  MANAGE_SEO = 'MANAGE_SEO',
  MANAGE_HERO = 'MANAGE_HERO',
  MANAGE_PAGES = 'MANAGE_PAGES',
  MANAGE_NAVIGATION = 'MANAGE_NAVIGATION',
  MANAGE_PAYMENTS = 'MANAGE_PAYMENTS',
  MANAGE_GDPR_SETTINGS = 'MANAGE_GDPR_SETTINGS',
  MANAGE_POLICY_DOCUMENTS = 'MANAGE_POLICY_DOCUMENTS',
  MANAGE_COMMITTEE = 'MANAGE_COMMITTEE',
  VIEW_ADMIN_DASHBOARD = 'VIEW_ADMIN_DASHBOARD'
}

export enum MembershipScanResult {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  INACTIVE = 'INACTIVE',
  NOT_FOUND = 'NOT_FOUND',
  CANCELLED = 'CANCELLED'
}

export const permissionLabels: Record<
  Permission,
  { label: string; description: string; section: string }
> = {
  [Permission.MANAGE_USERS]: {
    label: 'Users',
    description: 'Create and manage platform users and their permissions.',
    section: 'Access'
  },
  [Permission.MANAGE_MEMBERSHIPS]: {
    label: 'Memberships',
    description: 'Review, approve and manage member accounts and membership types.',
    section: 'Members'
  },
  [Permission.SCAN_MEMBERSHIPS]: {
    label: 'Scan memberships',
    description: 'Validate membership cards and record scans at the door.',
    section: 'Members'
  },
  [Permission.MANAGE_EVENTS]: {
    label: 'Events',
    description: 'Create, edit and delete events; scan tickets at the door.',
    section: 'Community'
  },
  [Permission.MANAGE_TICKETS]: {
    label: 'Tickets',
    description: 'Scan and validate event tickets, and manually issue tickets against existing payments.',
    section: 'Community'
  },
  [Permission.MANAGE_DIRECTORY]: {
    label: 'Directory',
    description: 'Manage business directory listings.',
    section: 'Community'
  },
  [Permission.MANAGE_JOBS]: {
    label: 'Jobs',
    description: 'Manage job advertisements in the directory.',
    section: 'Community'
  },
  [Permission.MANAGE_FUNDRAISERS]: {
    label: 'Fundraisers',
    description: 'Create and moderate fundraising campaigns and donations.',
    section: 'Community'
  },
  [Permission.MANAGE_BLOG]: {
    label: 'Blog',
    description: 'Write, edit and publish blog posts.',
    section: 'Content'
  },
  [Permission.MANAGE_FORUM]: {
    label: 'Forum moderation',
    description: 'Review flagged forum topics and posts.',
    section: 'Community'
  },
  [Permission.MANAGE_CONTACT_MESSAGES]: {
    label: 'Contact messages',
    description: 'Read and respond to contact form submissions.',
    section: 'Content'
  },
  [Permission.MANAGE_SITE_SETTINGS]: {
    label: 'Site settings',
    description: 'Update social links, contact details and global site settings.',
    section: 'Settings'
  },
  [Permission.MANAGE_SEO]: {
    label: 'SEO & Meta',
    description: 'Edit the default meta title, meta description and meta keywords used site-wide.',
    section: 'Settings'
  },
  [Permission.MANAGE_HERO]: {
    label: 'Hero',
    description: 'Update the homepage hero media and overlay.',
    section: 'Settings'
  },
  [Permission.MANAGE_GDPR_SETTINGS]: {
    label: 'GDPR & Privacy',
    description: 'Configure cookie consent, data retention and GDPR compliance settings.',
    section: 'Settings'
  },
  [Permission.MANAGE_POLICY_DOCUMENTS]: {
    label: 'Policy documents',
    description: 'Manage privacy policy, terms, membership policy and other legal documents.',
    section: 'Settings'
  },
  [Permission.MANAGE_PAGES]: {
    label: 'Pages',
    description: 'Create and edit CMS pages.',
    section: 'Settings'
  },
  [Permission.MANAGE_NAVIGATION]: {
    label: 'Navigation Menus',
    description: 'Edit the public site navigation: menu items, submenus and ordering.',
    section: 'Settings'
  },
  [Permission.MANAGE_PAYMENTS]: {
    label: 'Payments',
    description: 'Configure payment providers, process refunds and run revenue reports.',
    section: 'Finance'
  },
  [Permission.MANAGE_COMMITTEE]: {
    label: 'Committee',
    description: 'Manage committee member profiles.',
    section: 'Settings'
  },
  [Permission.VIEW_ADMIN_DASHBOARD]: {
    label: 'Admin dashboard',
    description: 'View the back-office dashboard and access permitted sections.',
    section: 'Access'
  }
};

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

export const eventCategoryLabels: Record<EventCategory, string> = {
  [EventCategory.CULTURAL]: 'Cultural',
  [EventCategory.SOCIAL]: 'Social',
  [EventCategory.SPORTS]: 'Sports',
  [EventCategory.CHARITY]: 'Charity',
  [EventCategory.EDUCATIONAL]: 'Educational',
  [EventCategory.COMMUNITY]: 'Community',
  [EventCategory.FAMILY]: 'Family',
  [EventCategory.RELIGIOUS]: 'Religious',
  [EventCategory.FOOD]: 'Food',
  [EventCategory.ENTERTAINMENT]: 'Entertainment',
  [EventCategory.BUSINESS]: 'Business',
  [EventCategory.OTHER]: 'Other'
};

export const eventCategoryColors: Record<EventCategory, string> = {
  [EventCategory.CULTURAL]: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  [EventCategory.SOCIAL]: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  [EventCategory.SPORTS]: 'bg-green-500/10 text-green-600 dark:text-green-400',
  [EventCategory.CHARITY]: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  [EventCategory.EDUCATIONAL]: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  [EventCategory.COMMUNITY]: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  [EventCategory.FAMILY]: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  [EventCategory.RELIGIOUS]: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  [EventCategory.FOOD]: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  [EventCategory.ENTERTAINMENT]: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
  [EventCategory.BUSINESS]: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  [EventCategory.OTHER]: 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
};
