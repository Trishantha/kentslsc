import { z } from 'zod';

export const fundraiserSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  targetAmount: z.number().min(0),
  imageUrl: z.string().url().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.boolean().default(true)
});

export const donationSchema = z.object({
  fundraiserId: z.string().uuid(),
  amount: z.number().min(1),
  message: z.string().optional()
});

export type FundraiserInput = z.infer<typeof fundraiserSchema>;
export type DonationInput = z.infer<typeof donationSchema>;
