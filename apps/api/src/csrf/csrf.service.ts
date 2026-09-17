import { Injectable } from '@nestjs/common';
import type { CookieOptions } from 'express';
import { csrfTokenCookieName } from '@kentslsc/shared';
import { generateToken } from '../common/utils/crypto.js';

const CSRF_HEADER_NAME = 'x-csrf-token';

@Injectable()
export class CsrfService {
  generateToken(): string {
    return generateToken();
  }

  getCookieName(): string {
    return csrfTokenCookieName(process.env.NODE_ENV === 'production');
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
