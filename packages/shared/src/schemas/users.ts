import { z } from 'zod';
import { structuredAddressSchema } from './memberships.js';

export const userProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: structuredAddressSchema.optional()
});

export const updateUserSchema = userProfileSchema.partial();

export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
