import { z } from 'zod';

export const dependantSchema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().int().min(0).max(120),
  relationship: z.enum(['spouse', 'child'])
});

export const membershipTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  isFree: z.boolean().default(false),
  durationMonths: z.number().int().min(1),
  benefits: z.array(z.string()).default([])
});

export const membershipApplySchema = z.object({
  membershipTypeId: z.string().uuid(),
  fullName: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
  dependants: z.array(dependantSchema).default([])
});

export const regenerateCardSchema = z.object({
  membershipId: z.string().min(1)
});

export const updateMembershipTypeSchema = membershipTypeSchema.partial();

export type DependantInput = z.infer<typeof dependantSchema>;
export type MembershipTypeInput = z.infer<typeof membershipTypeSchema>;
export type MembershipApplyInput = z.infer<typeof membershipApplySchema>;
export type UpdateMembershipTypeInput = z.infer<typeof updateMembershipTypeSchema>;
