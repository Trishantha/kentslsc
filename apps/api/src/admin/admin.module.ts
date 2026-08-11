import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { UsersModule } from '../users/users.module.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { EventsModule } from '../events/events.module.js';
import { DirectoryModule } from '../directory/directory.module.js';
import { FundraisingModule } from '../fundraising/fundraising.module.js';
import { BlogModule } from '../blog/blog.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { AdminUsersService } from './admin-users.service.js';

@Module({
  imports: [
    UsersModule,
    MembershipsModule,
    EventsModule,
    DirectoryModule,
    FundraisingModule,
    BlogModule,
    // AuthModule exports CredentialsService (set-password links) and
    // SessionsService (revoke on role change).
    AuthModule,
    EmailModule
  ],
  providers: [AdminService, AdminUsersService],
  controllers: [AdminController]
})
export class AdminModule {}
