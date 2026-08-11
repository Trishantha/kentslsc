import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AllowUnverified } from '../common/decorators/allow-unverified.decorator.js';
import type { TokenPayload } from '@kentslsc/shared';
import { UserRole } from '@kentslsc/shared';
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
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  list(@Query('page') page: string, @Query('limit') limit: string, @Query('role') role?: string) {
    return this.usersService.listUsers(Number(page) || 1, Number(limit) || 20, role);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  findOne(@Param('id') id: string) {
    return this.usersService.findByIdWithDetails(id);
  }
}
