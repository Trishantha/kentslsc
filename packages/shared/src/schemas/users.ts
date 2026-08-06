import { z } from 'zod';

export const userProfileSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional()
});

export const updateUserSchema = userProfileSchema.partial();

export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
