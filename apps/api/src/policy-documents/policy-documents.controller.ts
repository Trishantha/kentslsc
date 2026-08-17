import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PolicyDocumentsService } from './policy-documents.service.js';
import { UpdatePolicyDocumentDto } from './dto/update-policy-document.dto.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole, PolicyDocumentType } from '@kentslsc/shared';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Policy Documents')
@Controller('policy-documents')
export class PolicyDocumentsController {
  constructor(private readonly service: PolicyDocumentsService) {}

  @Public()
  @Get()
  listPublished() {
    return this.service.listPublished();
  }

  @Public()
  @Get(':type')
  getByType(@Param('type') type: PolicyDocumentType) {
    return this.service.findByType(type);
  }

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  listAdmin() {
    return this.service.listAdmin();
  }

  @Get('admin/:type')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  findAdminByType(@Param('type') type: PolicyDocumentType) {
    return this.service.findAdminByType(type);
  }

  @Put('admin/:type')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  upsert(
    @Param('type') type: PolicyDocumentType,
    @Body() dto: UpdatePolicyDocumentDto,
    @Req() req: Request
  ) {
    const user = req.user as Record<string, unknown> | undefined;
    const updatedBy = (user?.email as string) ?? (user?.id as string);
    return this.service.upsert(type, dto, updatedBy);
  }
}
