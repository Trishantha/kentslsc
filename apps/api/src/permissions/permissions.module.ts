import { Module } from '@nestjs/common';
import { PrismaModule } from '../core/prisma/prisma.module.js';
import { PermissionsService } from './permissions.service.js';
import { PermissionGuard } from '../common/guards/permission.guard.js';

@Module({
  imports: [PrismaModule],
  providers: [PermissionsService, PermissionGuard],
  exports: [PermissionsService, PermissionGuard]
})
export class PermissionsModule {}
