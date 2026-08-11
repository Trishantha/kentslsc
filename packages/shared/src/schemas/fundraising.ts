import { z } from 'zod';
import { FundraiserCategory } from '../enums.js';

export const fundraiserSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetAmount: z.number().min(0),
  imageUrl: z.string().url().optional().or(z.literal('')),
  imagePath: z.string().optional(),
  category: z.nativeEnum(FundraiserCategory).default(FundraiserCategory.CHARITY),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.boolean().default(true)
});

export const donationSchema = z.object({
  fundraiserId: z.string().uuid(),
  amount: z.number().min(1),
  message: z.string().max(500).optional(),
  displayName: z.string().max(100).optional(),
  isAnonymous: z.boolean().default(false)
});

export const fundraiserUpdateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1)
});

export const offlineDonationSchema = z.object({
  amount: z.number().min(0.01),
  displayName: z.string().max(100).optional(),
  message: z.string().max(500).optional(),
  donatedAt: z.coerce.date().optional()
});

export type FundraiserInput = z.infer<typeof fundraiserSchema>;
export type DonationInput = z.infer<typeof donationSchema>;
export type FundraiserUpdateInput = z.infer<typeof fundraiserUpdateSchema>;
export type OfflineDonationInput = z.infer<typeof offlineDonationSchema>;
