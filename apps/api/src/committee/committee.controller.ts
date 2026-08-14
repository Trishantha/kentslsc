import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommitteeService } from './committee.service.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { Permission } from '@kentslsc/shared';
import { Public } from '../common/decorators/public.decorator.js';
import { CreateCommitteeMemberDto, UpdateCommitteeMemberDto } from './dto/index.js';

@ApiTags('Committee')
@Controller('committee')
export class CommitteeController {
  constructor(private readonly committeeService: CommitteeService) {}

  @Public()
  @Get()
  list() {
    return this.committeeService.findAll();
  }

  @Post()
  @RequirePermission(Permission.MANAGE_COMMITTEE)
  @ApiBearerAuth()
  create(@Body() dto: CreateCommitteeMemberDto) {
    return this.committeeService.create(dto);
  }

  @Put(':id')
  @RequirePermission(Permission.MANAGE_COMMITTEE)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateCommitteeMemberDto) {
    return this.committeeService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(Permission.MANAGE_COMMITTEE)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.committeeService.remove(id);
  }
}
