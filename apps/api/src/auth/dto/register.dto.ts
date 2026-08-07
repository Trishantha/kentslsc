import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  IsBoolean,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@kentslsc/shared';
import { DependantDto } from '../../memberships/dto/dependant.dto.js';

export class RegisterApplicationDto {
  @IsUUID()
  declare membershipTypeId: string;

  @IsString()
  @MinLength(2)
  declare fullName: string;

  @IsOptional()
  @IsString()
  declare address?: string;

  @IsOptional()
  @IsString()
  declare phone?: string;

  @IsOptional()
  @IsString()
  declare dateOfBirth?: string;

  @IsOptional()
  @IsString()
  declare emergencyContactName?: string;

  @IsOptional()
  @IsString()
  declare emergencyContactPhone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  declare interests?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DependantDto)
  declare dependants?: DependantDto[];

  @IsBoolean()
  declare acceptedTerms: boolean;
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterApplicationDto)
  declare application?: RegisterApplicationDto;
}
