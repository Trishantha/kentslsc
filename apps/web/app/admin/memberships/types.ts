export interface AdminMembershipDependant {
  name: string;
  age: number;
  relationship: string;
}

export interface AdminMembershipType {
  id: string;
  name: string;
  description?: string | null;
  price?: number;
  isFree?: boolean;
  durationMonths?: number;
  features?: string[];
  autoActivate?: boolean;
  grantsMemberRole?: boolean;
  isPaused?: boolean;
}

export interface AdminMembership {
  id: string;
  membershipId: string;
  status: 'PENDING' | 'AWAITING_APPROVAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  progressStage?: 'FORM_SUBMITTED' | 'PAYMENT_PROCESSED' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  issuedAt?: string;
  membershipCardUrl: string | null;
  qrCodeValue: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  user: { id: string; name: string; email: string };
  membershipType: AdminMembershipType;
  dependants: AdminMembershipDependant[];
}

export interface ExportedMembership {
  membershipId: string;
  membershipStatus: string;
  membershipType: string;
  membershipTypeDescription: string;
  membershipPrice: number;
  membershipDurationMonths: number;
  startDate: string | null;
  endDate: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  paymentMethod: string;
  subscriptionStatus: string;
  creditAmountApplied: number | null;
  creditMonthsGranted: number | null;
  membershipCardUrl: string;
  qrCodeValue: string;
  dependantsCount: number;
  dependants: string;
  memberId: string;
  memberName: string;
  memberFirstName: string;
  memberLastName: string;
  memberEmail: string;
  memberPhone: string;
  memberRole: string;
  memberStatus: string;
  memberEmailVerifiedAt: string | null;
  memberCreatedAt: string;
  buildingStreet: string;
  locality: string;
  townCity: string;
  postcode: string;
}
