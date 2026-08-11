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
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@kentslsc/shared';
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
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  create(@Body() dto: CreateCommitteeMemberDto) {
    return this.committeeService.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateCommitteeMemberDto) {
    return this.committeeService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.committeeService.remove(id);
  }
}
