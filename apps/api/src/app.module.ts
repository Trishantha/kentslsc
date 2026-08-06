import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './core/prisma/prisma.module.js';
import { RedisModule } from './core/redis/redis.module.js';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true
    }),
    PrismaModule,
    RedisModule,
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
    PagesModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
