import { Permission } from '@kentslsc/shared';

export interface StructuredAddress {
  buildingStreet: string;
  locality?: string;
  townCity: string;
  postcode: string;
}

export interface MembershipItem {
  id: string;
  membershipId: string;
  status: string;
  startDate: string;
  endDate: string;
  membershipCardUrl: string | null;
  qrCodeValue: string | null;
  dependantsJson: unknown;
  createdAt: string;
  paidAt: string | null;
  paymentMethod: string | null;
  membershipType: {
    name: string;
    description?: string | null;
    price: number;
    isFree: boolean;
    durationMonths: number;
  };
}

export interface TicketItem {
  id: string;
  status: string;
  purchaseDatetime: string;
  stripeSessionId: string | null;
  event: {
    title: string;
    startDatetime: string;
  };
}

export interface DonationItem {
  id: string;
  amount: number;
  message?: string | null;
  donatedAt: string;
  fundraiser: {
    title: string;
  };
}

export interface ListingItem {
  id: string;
  businessName: string;
  category?: string | null;
  isPaid: boolean;
  isPromoted: boolean;
  createdAt: string;
}

export interface ForumTopicItem {
  id: string;
  title: string;
  createdAt: string;
}

export interface ForumPostItem {
  id: string;
  content: string;
  createdAt: string;
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface ExportedUser {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  emailVerifiedAt: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
  buildingStreet: string;
  locality: string;
  townCity: string;
  postcode: string;
  latestMembershipType: string;
  latestMembershipStatus: string;
  latestMembershipStartDate: string | null;
  latestMembershipEndDate: string | null;
  latestMembershipCardUrl: string;
}

export interface UserDetail extends UserItem {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  address?: StructuredAddress | null;
  updatedAt: string;
  memberships: MembershipItem[];
  tickets: TicketItem[];
  listings: ListingItem[];
  donations: DonationItem[];
  topics: ForumTopicItem[];
  posts: ForumPostItem[];
}

export interface UsersResponse {
  items: UserItem[];
  total: number;
  page: number;
  limit: number;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: { permission: Permission }[];
}

export interface UserPermissionsDetail {
  roleId: string | null;
  direct: Permission[];
  inherited: Permission[];
  effective: Permission[];
}
