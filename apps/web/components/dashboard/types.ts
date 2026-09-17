import { MembershipFeature } from '@kentslsc/shared';
import type { MembershipBase } from '@/lib/membership-types';

export interface MembershipResponse extends MembershipBase {
  progressStage?: 'FORM_SUBMITTED' | 'AWAITING_APPROVAL' | 'AWAITING_PAYMENT' | 'PAYMENT_PROCESSED' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  cardUrl: string | null;
  qr: string | null;
  dependantsCount: number;
  dependants: { name: string; age: number; relationship: string }[];
  creditAmountApplied: number | null;
  creditMonthsGranted: number | null;
  stripeSubscriptionId: string | null;
  membershipType: MembershipBase['membershipType'] & {
    benefits: string[];
    features: MembershipFeature[];
  };
}
