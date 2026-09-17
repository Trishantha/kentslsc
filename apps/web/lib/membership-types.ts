/**
 * Canonical base shape for membership API responses. The dashboard and admin
 * endpoints return different projections of the same resource; both extend
 * this base and add their endpoint-specific fields.
 */
export interface MembershipTypeSummary {
  name: string;
  description?: string | null;
  price: number;
  isFree: boolean;
}

export interface MembershipBase {
  id: string;
  membershipId: string;
  status: string;
  startDate: string;
  endDate: string;
  paidAt: string | null;
  paymentMethod: string | null;
  membershipType: MembershipTypeSummary;
}
