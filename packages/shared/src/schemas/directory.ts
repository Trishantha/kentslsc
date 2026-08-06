import { z } from 'zod';

export const businessListingSchema = z.object({
  businessName: z.string().min(1),
  logoUrl: z.string().url().optional(),
  description: z.string().optional(),
  servicesText: z.string().optional(),
  websiteUrl: z.string().url().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  isPaid: z.boolean().default(false),
  category: z.string().optional()
});

export const jobAdSchema = z.object({
  businessListingId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  salaryRange: z.string().optional(),
  contactEmail: z.string().email().optional(),
  closingDate: z.coerce.date().optional(),
  isPublished: z.boolean().default(false)
});

export type BusinessListingInput = z.infer<typeof businessListingSchema>;
export type JobAdInput = z.infer<typeof jobAdSchema>;
