import { MembershipFeature } from '@kentslsc/shared';

export interface MembershipResponse {
  id: string;
  membershipId: string;
  status: string;
  progressStage?: 'FORM_SUBMITTED' | 'AWAITING_APPROVAL' | 'AWAITING_PAYMENT' | 'PAYMENT_PROCESSED' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  startDate: string;
  endDate: string;
  cardUrl: string | null;
  qr: string | null;
  dependantsCount: number;
  dependants: { name: string; age: number; relationship: string }[];
  paidAt: string | null;
  paymentMethod: string | null;
  creditAmountApplied: number | null;
  creditMonthsGranted: number | null;
  stripeSubscriptionId: string | null;
  membershipType: {
    name: string;
    description?: string | null;
    benefits: string[];
    features: MembershipFeature[];
    isFree: boolean;
    price: number;
  };
}
