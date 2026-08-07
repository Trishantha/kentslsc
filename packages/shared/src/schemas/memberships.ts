import { z } from 'zod';
import { MembershipFeature } from '../enums.js';

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
  benefits: z.array(z.string()).default([]),
  features: z.array(z.nativeEnum(MembershipFeature)).default([]),
  autoActivate: z.boolean().default(false)
});

export const membershipApplySchema = z.object({
  membershipTypeId: z.string().uuid(),
  fullName: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
  dependants: z.array(dependantSchema).default([])
});

export const registrationWizardSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    phone: z.string().optional(),
    address: z.string().optional(),
    dateOfBirth: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    interests: z.array(z.string()).default([]),
    membershipTypeId: z.string().uuid(),
    dependants: z.array(dependantSchema).default([]),
    acceptedTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms and conditions'
    })
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export const regenerateCardSchema = z.object({
  membershipId: z.string().min(1)
});

export const updateMembershipTypeSchema = membershipTypeSchema.partial();

export type DependantInput = z.infer<typeof dependantSchema>;
export type MembershipTypeInput = z.infer<typeof membershipTypeSchema>;
export type MembershipApplyInput = z.infer<typeof membershipApplySchema>;
export type RegistrationWizardInput = z.infer<typeof registrationWizardSchema>;
export type UpdateMembershipTypeInput = z.infer<typeof updateMembershipTypeSchema>;
