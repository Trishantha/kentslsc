import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** 32 random bytes, url-safe. Only a hash of tokens should ever be persisted. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
