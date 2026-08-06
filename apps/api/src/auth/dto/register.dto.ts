import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@kentslsc/shared';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  declare name: string;

  @IsEmail()
  declare email: string;

  @IsString()
  @MinLength(8)
  declare password: string;

  @IsOptional()
  @IsString()
  declare phone?: string;

  @IsOptional()
  @IsString()
  declare address?: string;

  @IsOptional()
  @IsEnum(UserRole)
  declare role?: UserRole;
}
