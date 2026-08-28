export interface AdminBusiness {
  id: string;
  businessName: string;
  logoUrl: string | null;
  description: string | null;
  servicesText: string | null;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  youtube: string | null;
  linkedin: string | null;
  tiktok: string | null;
  isPaid: boolean;
  isPromoted?: boolean;
  promotedUntil?: string | null;
  promotionPaidAt?: string | null;
  promotionPaymentMethod?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminJob {
  id: string;
  businessListingId: string;
  title: string;
  description: string | null;
  location: string | null;
  salaryRange: string | null;
  contactEmail: string | null;
  closingDate: string | null;
  isPublished: boolean;
  businessListing?: { id: string; businessName: string; logoUrl: string | null } | null;
}
