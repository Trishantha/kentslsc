import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './jwt.strategy.js';
import { SessionsService } from './sessions.service.js';
import { CredentialsService } from './credentials.service.js';
import { LoginLockoutService } from './login-lockout.service.js';
import { TokenModule } from './token.module.js';
import { UsersModule } from '../users/users.module.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { EmailModule } from '../email/email.module.js';

import { AuthBootstrapService } from './auth-bootstrap.service.js';
import { CsrfModule } from '../csrf/csrf.module.js';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRY') ?? '15m') as never
        }
      }),
      inject: [ConfigService]
    }),
    UsersModule,
    MembershipsModule,
    AuthorizationModule,
    PermissionsModule,
    TokenModule,
    // Required for verification, reset and lockout mail. AuthModule did not
    // import this before, and EmailModule is not @Global().
    EmailModule,
    CsrfModule
  ],
  providers: [AuthService, AuthBootstrapService, JwtStrategy, SessionsService, CredentialsService, LoginLockoutService],
  controllers: [AuthController],
  // Re-export TokenModule (not the service directly — AuthModule doesn't provide
  // it) so consumers of AuthModule can validate tokens through the same path as
  // HTTP: deleted-user check plus revocation denylist.
  exports: [AuthService, SessionsService, CredentialsService, TokenModule]
})
export class AuthModule {}
