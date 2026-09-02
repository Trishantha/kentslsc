import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PolicyDocumentsService } from './policy-documents.service.js';
import { UpdatePolicyDocumentDto } from './dto/update-policy-document.dto.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Permission, PolicyDocumentType } from '@kentslsc/shared';
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
  @ApiBearerAuth()
  @RequirePermission(Permission.MANAGE_POLICY_DOCUMENTS)
  listAdmin() {
    return this.service.listAdmin();
  }

  @Get('admin/:type')
  @ApiBearerAuth()
  @RequirePermission(Permission.MANAGE_POLICY_DOCUMENTS)
  findAdminByType(@Param('type') type: PolicyDocumentType) {
    return this.service.findAdminByType(type);
  }

  @Put('admin/:type')
  @ApiBearerAuth()
  @RequirePermission(Permission.MANAGE_POLICY_DOCUMENTS)
  upsert(
    @Param('type') type: PolicyDocumentType,
    @Body() dto: UpdatePolicyDocumentDto,
    @Req() req: any
  ) {
    const updatedBy = req.user?.email ?? req.user?.id;
    return this.service.upsert(type, dto, updatedBy);
  }
}
