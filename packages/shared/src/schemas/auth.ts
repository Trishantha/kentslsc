import { z } from 'zod';
import { UserRole } from '../enums.js';
import { dependantSchema, structuredAddressSchema } from './memberships.js';

export const registerApplicationSchema = z.object({
  membershipTypeId: z.string().uuid(),
  fullName: z.string().min(2),
  address: structuredAddressSchema.optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  interests: z.array(z.string()).default([]),
  dependants: z.array(dependantSchema).default([]),
  acceptedTerms: z.boolean()
});

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  address: structuredAddressSchema.optional(),
  role: z.nativeEnum(UserRole).default(UserRole.GUEST),
  application: registerApplicationSchema.optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string()
});

export const tokenPayloadSchema = z.object({
  sub: z.string(),
  email: z.string(),
  role: z.nativeEnum(UserRole),
  iat: z.number().optional(),
  exp: z.number().optional()
});

export type RegisterApplicationInput = z.infer<typeof registerApplicationSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
