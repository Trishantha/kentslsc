import { MembershipFeature } from '@kentslsc/shared';

export interface AdminMembershipType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isFree: boolean;
  durationMonths: number;
  maxIssuances: number | null;
  issuedCount: number;
  hasCapacity: boolean;
  benefits: string[];
  features: MembershipFeature[];
  autoActivate: boolean;
}
