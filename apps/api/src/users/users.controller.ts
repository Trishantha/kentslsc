import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AllowUnverified } from '../common/decorators/allow-unverified.decorator.js';
import type { TokenPayload } from '@kentslsc/shared';
import { Permission } from '@kentslsc/shared';
import { UpdateUserDto } from './dto/update-user.dto.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @AllowUnverified()
  @ApiBearerAuth()
  me(@CurrentUser() user: TokenPayload) {
    return this.usersService.findById(user.sub);
  }

  @Put('me')
  @AllowUnverified()
  @ApiBearerAuth()
  updateMe(@CurrentUser() user: TokenPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.sub, dto);
  }

  @Delete('me')
  @AllowUnverified()
  @ApiBearerAuth()
  deleteMe(@CurrentUser() user: TokenPayload) {
    return this.usersService.softDelete(user.sub);
  }

  @Get('me/export')
  @AllowUnverified()
  @ApiBearerAuth()
  exportMe(@CurrentUser() user: TokenPayload) {
    return this.usersService.exportData(user.sub);
  }

  @Get()
  @RequirePermission(Permission.MANAGE_USERS)
  @ApiBearerAuth()
  list(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('role') role?: string,
    @Query('search') search?: string
  ) {
    return this.usersService.listUsers(Number(page) || 1, Number(limit) || 20, role, search);
  }

  @Get(':id')
  @RequirePermission(Permission.MANAGE_USERS)
  @ApiBearerAuth()
  findOne(@Param('id') id: string) {
    return this.usersService.findByIdWithDetails(id);
  }
}
