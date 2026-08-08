import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { fileURLToPath } from 'url';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { envValidationSchema } from './core/config/env.validation.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { RedisModule } from './core/redis/redis.module.js';
import { RedisThrottlerStorage } from './core/throttler/redis-throttler.storage.js';
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
import { EmailModule } from './email/email.module.js';
import { AdminModule } from './admin/admin.module.js';
import { PagesModule } from './pages/pages.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { HeroConfigModule } from './hero-config/hero-config.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      envFilePath: fileURLToPath(new URL('../../../.env', import.meta.url)),
      validate: (config) => envValidationSchema.parse(config)
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        storage,
        throttlers: [
          {
            name: 'default',
            limit: 60,
            ttl: 60
          }
        ]
      })
    }),
    PrismaModule,
    RedisModule,
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
    EmailModule,
    AdminModule,
    PagesModule,
    UploadsModule,
    HeroConfigModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
