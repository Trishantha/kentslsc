import { applyDecorators } from '@nestjs/common';
import { IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@kentslsc/shared';

/**
 * Server-side mirror of `passwordSchema` in @kentslsc/shared.
 *
 * The web app validates with the zod schema; this is the authoritative check,
 * since the client one can simply be skipped. Shared constants keep the two
 * from drifting on length.
 */
export function StrongPassword() {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters`
    }),
    Matches(/[a-z]/, { message: 'Password must contain a lowercase letter' }),
    Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' }),
    Matches(/[0-9]/, { message: 'Password must contain a number' })
  );
}
