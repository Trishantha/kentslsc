import { z } from 'zod';

/**
 * Single definition of the password rules, shared by the web forms and mirrored
 * by the API's class-validator DTOs. Length does most of the work; the
 * character-class rules mainly rule out the obvious `password1234`.
 *
 * Lives in its own module because both auth.ts and memberships.ts need it and
 * auth.ts already imports from memberships.ts — importing back would be a cycle.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

/** Reject passwords that just restate the user's own details. */
export function passwordContainsIdentity(
  password: string,
  ...identityParts: (string | undefined)[]
): boolean {
  const lowered = password.toLowerCase();
  return identityParts
    .filter((part): part is string => Boolean(part && part.length >= 3))
    .some((part) => lowered.includes(part.toLowerCase()));
}
