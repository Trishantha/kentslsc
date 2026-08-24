import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limiting guard that excludes requests originating from the local machine.
 *
 * On Hostinger the unified server runs the API and Next.js web handler in the
 * same process. Server-side fetches, startup health probes and internal API
 * calls all arrive from 127.0.0.1. Without this exemption they share a single
 * throttle bucket with public traffic and can trigger 429 responses during normal
 * page rendering. Public traffic uses the real client IP only when `TRUST_PROXY=true`
 * is set explicitly.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (await super.shouldSkip(context)) {
      return true;
    }

    const { req } = this.getRequestResponse(context);
    if (!req) {
      return false;
    }

    const candidates = [
      req.ip,
      req.socket?.remoteAddress,
      req.connection?.remoteAddress
    ].filter((ip): ip is string => typeof ip === 'string' && ip.length > 0);

    return candidates.some((ip) => isLocalAddress(ip));
  }
}

function isLocalAddress(ip: unknown): boolean {
  if (typeof ip !== 'string' || ip.length === 0) {
    return false;
  }

  const normalized = ip.toLowerCase().replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1';
}
