import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { CookieOptions } from 'express';

export const CSRF_COOKIE_NAME = 'csrfToken';
export const CSRF_HEADER_NAME = 'x-csrf-token';

@Injectable()
export class CsrfService {
  generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  getCookieName(): string {
    return CSRF_COOKIE_NAME;
  }

  getHeaderName(): string {
    return CSRF_HEADER_NAME;
  }

  getCookieOptions(): CookieOptions {
    return {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    };
  }
}
