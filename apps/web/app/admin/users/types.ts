import { Permission } from '@kentslsc/shared';
import type { MembershipBase } from '@/lib/membership-types';

export interface StructuredAddress {
  buildingStreet: string;
  locality?: string;
  townCity: string;
  postcode: string;
}

export interface MembershipItem extends MembershipBase {
  membershipCardUrl: string | null;
  qrCodeValue: string | null;
  dependantsJson: unknown;
  createdAt: string;
  membershipType: MembershipBase['membershipType'] & {
    durationMonths: number;
  };
}

export interface DependantItem {
  name: string;
  age: number;
  relationship: 'spouse' | 'child';
  membershipId: string;
  membershipTypeName: string;
  membershipStatus: string;
}

export interface TicketItem {
  id: string;
  qrCodeValue: string;
  ticketNumber: string | null;
  serialNumber: number | null;
  status: string;
  purchaseDatetime: string;
  stripeSessionId: string | null;
  event: {
    id: string;
    title: string;
    startDatetime: string;
    endDatetime: string;
    location: string | null;
    imageUrl: string | null;
    ticketDesign: Record<string, unknown> | null;
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

export interface TransactionItem {
  id: string;
  receiptNumber: string | null;
  date: string;
  description: string | null;
  currency: string;
  grossAmount: number;
  processingFee: number;
  netAmount: number;
  refundedAmount: number | null;
  paymentChannel: string;
  paymentMethod: string | null;
  paymentStatus: string;
  sourceType: string;
  sourceId: string | null;
  related: {
    event: { id: string; title: string } | null;
    membership: { id: string; membershipId: string } | null;
    donation: { id: string; fundraiser: { title: string } } | null;
    businessListing: { id: string; businessName: string } | null;
    jobAd: { id: string; title: string } | null;
  };
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
  dependants: DependantItem[];
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
