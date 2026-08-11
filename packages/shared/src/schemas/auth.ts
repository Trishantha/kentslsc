import { z } from 'zod';
import { UserRole } from '../enums.js';
import { dependantSchema, structuredAddressSchema } from './memberships.js';
import { passwordSchema } from './password.js';

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword']
  });

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
  password: passwordSchema,
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

/**
 * `typ` separates the three tokens we mint. Without it the short-lived socket
 * token — which is handed to browser JavaScript — is byte-for-byte usable as an
 * access token, so an XSS could trade one for the other.
 */
export const tokenTypeSchema = z.enum(['access', 'refresh', 'ws']);

export const tokenPayloadSchema = z.object({
  sub: z.string(),
  email: z.string(),
  role: z.nativeEnum(UserRole),
  /** Session id: stable across refresh rotation, so revocation is per device. */
  sid: z.string().optional(),
  /** Unique per issued token, for targeted revocation. */
  jti: z.string().optional(),
  typ: tokenTypeSchema.optional(),
  iat: z.number().optional(),
  exp: z.number().optional()
});

export type RegisterApplicationInput = z.infer<typeof registerApplicationSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
export type TokenType = z.infer<typeof tokenTypeSchema>;
