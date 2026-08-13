import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthEventType } from '@kentslsc/database';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { UserRole } from '@kentslsc/shared';

/**
 * Emergency admin password recovery.
 *
 * When a deployment environment has no shell access (e.g. Hostinger Node app
 * manager), a normal CLI reset cannot run. Setting ADMIN_EMERGENCY_PASSWORD in
 * the backend environment variables and redeploying/restarting the API will reset
 * the named admin account's password before the app starts serving requests.
 *
 * SECURITY:
 * - The password is set in the server environment, never in code or the repo.
 * - If the variable is left set, the password is reset on every restart. Remove
 *   the variable immediately after logging in and change the password from the UI.
 */
@Injectable()
export class AuthBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AuthBootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit() {
    const emergencyPassword = this.config.get<string>('ADMIN_EMERGENCY_PASSWORD');
    if (!emergencyPassword) return;

    const email = (this.config.get<string>('ADMIN_EMERGENCY_EMAIL') ?? 'admin@kentslsc.org').toLowerCase().trim();

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.logger.warn(`ADMIN_EMERGENCY_PASSWORD is set but no account exists for ${email}`);
      return;
    }

    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`ADMIN_EMERGENCY_PASSWORD is set but ${email} is not an admin`);
      return;
    }

    const passwordHash = await bcrypt.hash(emergencyPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { email },
        data: { passwordHash, passwordChangedAt: new Date() }
      }),
      this.prisma.authEvent.create({
        data: {
          userId: user.id,
          email: user.email,
          type: AuthEventType.PASSWORD_CHANGED,
          metadata: { source: 'auth-bootstrap-emergency' }
        }
      }),
      this.prisma.authEvent.create({
        data: {
          userId: user.id,
          email: user.email,
          type: AuthEventType.LOCKOUT_CLEARED,
          metadata: { source: 'auth-bootstrap-emergency', reason: 'admin-password-reset' }
        }
      })
    ]);

    this.logger.warn(`Emergency admin password reset applied for ${email}. Remove ADMIN_EMERGENCY_PASSWORD from the environment and change the password after login.`);
  }
}
