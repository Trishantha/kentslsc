import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthEventType } from '@kentslsc/database';
import { PrismaService } from '../core/prisma/prisma.service.js';
import { UserRole } from '@kentslsc/shared';
import { hashPassword } from '../common/utils/crypto.js';

/**
 * Emergency admin account recovery / creation.
 *
 * When a deployment environment has no shell access (e.g. Hostinger Node app
 * manager), a normal CLI reset/seed cannot run. To use recovery, set both
 * ADMIN_EMERGENCY_PASSWORD and ADMIN_EMERGENCY_RESET_ENABLED=true in the
 * backend environment variables and redeploy/restart the API. This will:
 *
 * - Create an admin account for ADMIN_EMERGENCY_EMAIL if it does not exist.
 * - Reset the password and clear any lockout for that account if it does exist.
 *
 * SECURITY:
 * - The password is set in the server environment, never in code or the repo.
 * - ADMIN_EMERGENCY_PASSWORD alone is not enough to trigger a reset; an explicit
 *   ADMIN_EMERGENCY_RESET_ENABLED=true flag is required for each restart where
 *   recovery is intended. Remove both variables immediately after logging in and
 *   change the password from the UI.
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

    const resetEnabled = this.config.get<string>('ADMIN_EMERGENCY_RESET_ENABLED') === 'true';
    if (!resetEnabled) {
      this.logger.error(
        'ADMIN_EMERGENCY_PASSWORD is configured but ADMIN_EMERGENCY_RESET_ENABLED is not "true". ' +
          'Emergency admin recovery is disabled. Set ADMIN_EMERGENCY_RESET_ENABLED=true only for ' +
          'the single restart where recovery is required, then remove both variables.'
      );
      return;
    }

    const email = (this.config.get<string>('ADMIN_EMERGENCY_EMAIL') ?? 'admin@kentslsc.org').toLowerCase().trim();
    const passwordHash = await hashPassword(emergencyPassword);

    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (!existingUser) {
      const newUser = await this.prisma.user.create({
        data: {
          name: 'Emergency Admin',
          email,
          passwordHash,
          role: UserRole.ADMIN,
          emailVerifiedAt: new Date()
        }
      });

      await this.prisma.authEvent.create({
        data: {
          userId: newUser.id,
          email: newUser.email,
          type: AuthEventType.ADMIN_USER_CREATED,
          metadata: { source: 'auth-bootstrap-emergency' }
        }
      });

      this.logger.warn(`Emergency admin account created for ${email}. Remove ADMIN_EMERGENCY_PASSWORD from the environment and change the password after login.`);
      return;
    }

    if (existingUser.role !== UserRole.ADMIN) {
      this.logger.warn(`ADMIN_EMERGENCY_PASSWORD is set but ${email} is not an admin`);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { email },
        data: { passwordHash, passwordChangedAt: new Date() }
      }),
      this.prisma.authEvent.create({
        data: {
          userId: existingUser.id,
          email: existingUser.email,
          type: AuthEventType.PASSWORD_CHANGED,
          metadata: { source: 'auth-bootstrap-emergency' }
        }
      }),
      this.prisma.authEvent.create({
        data: {
          userId: existingUser.id,
          email: existingUser.email,
          type: AuthEventType.LOCKOUT_CLEARED,
          metadata: { source: 'auth-bootstrap-emergency', reason: 'admin-password-reset' }
        }
      })
    ]);

    this.logger.warn(`Emergency admin password reset applied for ${email}. Remove ADMIN_EMERGENCY_PASSWORD from the environment and change the password after login.`);
  }
}
