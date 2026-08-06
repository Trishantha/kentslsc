import { z } from 'zod';
import { UserRole } from '../enums.js';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  address: z.string().optional(),
  role: z.nativeEnum(UserRole).default(UserRole.GUEST)
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TokenPayload = z.infer<typeof tokenPayloadSchema>;
