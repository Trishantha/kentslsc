import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { UserRole, UserStatus } from '@kentslsc/shared';
import { StrongPassword } from '../../common/validators/strong-password.decorator.js';

export class AdminCreateUserDto {
  @IsString()
  @MinLength(1)
  declare firstName: string;

  @IsString()
  @MinLength(1)
  declare lastName: string;

  @IsEmail()
  declare email: string;

  @IsEnum(UserRole)
  declare role: UserRole;

  @IsOptional()
  @IsString()
  declare phone?: string;

  /**
   * When true the account is created without a password and the user receives a
   * set-password link. Preferred: it means the admin never handles, transmits,
   * or knows the user's password.
   */
  @IsOptional()
  @IsBoolean()
  declare sendInvite?: boolean;

  @ValidateIf((o: AdminCreateUserDto) => o.sendInvite !== true)
  @StrongPassword()
  declare password?: string;

  /** Admin-created accounts are trusted by default; set false to require verification. */
  @IsOptional()
  @IsBoolean()
  declare markEmailVerified?: boolean;
}

export class AdminUpdateRoleDto {
  @IsEnum(UserRole)
  declare role: UserRole;
}

export class AdminUpdateStatusDto {
  @IsEnum(UserStatus)
  declare status: UserStatus;
}
