import { z } from 'zod';
import { directoryCategoryValues } from '../directory-categories.js';

export const optionalUrl = (message = 'Enter a valid URL') =>
  z.preprocess(
    (val) => {
      if (typeof val !== 'string' || val.trim() === '') return undefined;
      const v = val.trim();
      return /^https?:\/\//i.test(v) ? v : `https://${v}`;
    },
    z.string().url({ message }).optional()
  );

export const businessListingSchema = z.object({
  businessName: z.string().min(1),
  logoUrl: z.string().url().optional(),
  description: z.string().optional(),
  servicesText: z.string().optional(),
  websiteUrl: optionalUrl('Enter a valid website URL, e.g. example.com'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  facebook: optionalUrl('Enter a valid Facebook URL'),
  instagram: optionalUrl('Enter a valid Instagram URL'),
  twitter: optionalUrl('Enter a valid X/Twitter URL'),
  youtube: optionalUrl('Enter a valid YouTube URL'),
  linkedin: optionalUrl('Enter a valid LinkedIn URL'),
  tiktok: optionalUrl('Enter a valid TikTok URL'),
  isPaid: z.boolean().default(false),
  category: z
    .string()
    .refine((val) => !val || directoryCategoryValues.includes(val), {
      message: 'Select a valid category'
    })
    .optional()
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
