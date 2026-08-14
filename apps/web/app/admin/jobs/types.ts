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
  createdAt?: string;
  updatedAt?: string;
}

export interface JobApplication {
  id: string;
  jobAdId: string;
  name: string;
  email: string;
  phone?: string | null;
  coverLetter?: string | null;
  cvUrl?: string | null;
  createdAt: string;
}
