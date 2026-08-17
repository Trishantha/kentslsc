export interface AdminMembershipDependant {
  name: string;
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
}

export interface AdminMembership {
  id: string;
  membershipId: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
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
