export interface AdminFundraiser {
  id: string;
  title: string;
  description: string | null;
  targetAmount: number;
  raisedAmount: number;
  totalDonors: number;
  imageUrl: string | null;
  imagePath: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: string;
  category: string;
  rejectionReason?: string | null;
  createdAt?: string;
  organizer?: { id?: string; name: string; firstName?: string | null; lastName?: string | null } | null;
  updates?: FundraiserUpdate[];
}

export interface FundraiserUpdate {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author?: { name: string; firstName?: string | null; lastName?: string | null };
}

export interface FundraiserDonation {
  id: string;
  amount: number;
  displayName: string;
  message?: string | null;
  isAnonymous: boolean;
  isOffline: boolean;
  donatedAt: string;
}

export interface FundraisingStats {
  activeCampaigns: number;
  pendingCount: number;
  totalRaised: number;
  totalDonors: number;
  recentDonations?: unknown[];
}

export const FUNDRAISER_CATEGORIES = [
  { value: 'CHARITY', label: 'Charity' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'COMMUNITY', label: 'Community' },
  { value: 'MEMORIAL', label: 'Memorial' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'OTHER', label: 'Other' }
] as const;

export const FUNDRAISER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400',
  PENDING_APPROVAL: 'bg-amber-500/10 text-amber-400',
  REJECTED: 'bg-red-500/10 text-red-400',
  COMPLETED: 'bg-slate-500/10 text-slate-400'
};
