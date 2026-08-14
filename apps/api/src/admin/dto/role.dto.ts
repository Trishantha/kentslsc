import { IsArray, IsOptional, IsString, IsEnum } from 'class-validator';
import { Permission } from '@kentslsc/shared';

export class CreateRoleDto {
  @IsString()
  declare name: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsArray()
  @IsEnum(Permission, { each: true })
  declare permissions: Permission[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  declare name?: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  declare permissions?: Permission[];
}

export class AssignRoleDto {
  @IsOptional()
  @IsString()
  declare roleId?: string | null;
}

export class SetUserPermissionsDto {
  @IsArray()
  @IsEnum(Permission, { each: true })
  declare permissions: Permission[];
}
