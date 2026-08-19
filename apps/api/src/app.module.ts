import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { fileURLToPath } from 'url';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { envValidationSchema } from './core/config/env.validation.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { SupabaseModule } from './core/supabase/supabase.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { MembershipsModule } from './memberships/memberships.module.js';
import { EventsModule } from './events/events.module.js';
import { DirectoryModule } from './directory/directory.module.js';
import { ForumModule } from './forum/forum.module.js';
import { FundraisingModule } from './fundraising/fundraising.module.js';
import { BlogModule } from './blog/blog.module.js';
import { ContactModule } from './contact/contact.module.js';
import { AiModule } from './ai/ai.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { StripeWebhookModule } from './payments/stripe-webhook.module.js';
import { EmailModule } from './email/email.module.js';
import { AdminModule } from './admin/admin.module.js';
import { PagesModule } from './pages/pages.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { HeroConfigModule } from './hero-config/hero-config.module.js';
import { CommitteeModule } from './committee/committee.module.js';
import { SiteSettingsModule } from './site-settings/site-settings.module.js';
import { PolicyDocumentsModule } from './policy-documents/policy-documents.module.js';
import { GdprSettingsModule } from './gdpr-settings/gdpr-settings.module.js';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { PermissionGuard } from './common/guards/permission.guard.js';
import { FeatureGuard } from './common/guards/feature.guard.js';
import { EmailVerifiedGuard } from './common/guards/email-verified.guard.js';
import { CsrfModule } from './csrf/csrf.module.js';
import { CsrfGuard } from './csrf/csrf.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: fileURLToPath(new URL('../../../.env', import.meta.url)),
      validate: (config) => envValidationSchema.parse(config)
    }),
    ThrottlerModule.forRoot({
      // ttl and blockDuration are MILLISECONDS in @nestjs/throttler v6.
      throttlers: [
        {
          name: 'default',
          limit: 120,
          ttl: 60_000
        }
      ]
    }),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    UsersModule,
    MembershipsModule,
    EventsModule,
    DirectoryModule,
    ForumModule,
    FundraisingModule,
    BlogModule,
    ContactModule,
    AiModule,
    PaymentsModule,
    StripeWebhookModule,
    EmailModule,
    AdminModule,
    PagesModule,
    UploadsModule,
    HeroConfigModule,
    CommitteeModule,
    SiteSettingsModule,
    PolicyDocumentsModule,
    GdprSettingsModule,
    // Provides FeatureGuard + MembershipFeaturesService to the global guard above.
    AuthorizationModule,
    PermissionsModule,
    CsrfModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard order is array order. Authorization is now DENY BY DEFAULT: every
    // route requires a valid session unless explicitly marked @Public().
    // Previously guards were opt-in per handler (~63 @UseGuards call sites), so
    // a single forgotten decorator silently published an endpoint.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: EmailVerifiedGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: FeatureGuard }
  ]
})
export class AppModule {}
