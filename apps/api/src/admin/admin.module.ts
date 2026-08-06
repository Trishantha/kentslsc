import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { UsersModule } from '../users/users.module.js';
import { MembershipsModule } from '../memberships/memberships.module.js';
import { EventsModule } from '../events/events.module.js';
import { DirectoryModule } from '../directory/directory.module.js';
import { FundraisingModule } from '../fundraising/fundraising.module.js';
import { BlogModule } from '../blog/blog.module.js';

@Module({
  imports: [UsersModule, MembershipsModule, EventsModule, DirectoryModule, FundraisingModule, BlogModule],
  providers: [AdminService],
  controllers: [AdminController]
})
export class AdminModule {}
