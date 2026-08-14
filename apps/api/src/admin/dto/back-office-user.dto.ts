import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf
} from 'class-validator';
import { Permission, UserRole } from '@kentslsc/shared';
import { StrongPassword } from '../../common/validators/strong-password.decorator.js';

export class AddExistingBackOfficeUserDto {
  @IsUUID()
  declare userId: string;

  @IsOptional()
  @IsUUID()
  declare roleId?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  declare permissions?: Permission[];

  @IsOptional()
  @IsBoolean()
  declare sendInvite?: boolean;
}

export class InviteBackOfficeUserDto {
  @IsString()
  @MinLength(1)
  declare firstName: string;

  @IsString()
  @MinLength(1)
  declare lastName: string;

  @IsEmail()
  declare email: string;

  @IsOptional()
  @IsString()
  declare phone?: string;

  @IsOptional()
  @IsUUID()
  declare roleId?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Permission, { each: true })
  declare permissions?: Permission[];

  @IsOptional()
  @IsBoolean()
  declare sendInvite?: boolean;

  @ValidateIf((o: InviteBackOfficeUserDto) => o.sendInvite !== true)
  @StrongPassword()
  declare password?: string;
}

export class BackOfficeUserResponseDto {
  declare id: string;
  declare name: string;
  declare email: string;
  declare role: UserRole;
  declare permissions: Permission[];
  declare createdAt: Date;
}
