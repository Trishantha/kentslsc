import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsUUID,
  IsArray,
  IsBoolean,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { DependantDto } from '../../memberships/dto/dependant.dto.js';
import { StructuredAddressDto } from './address.dto.js';
import { StrongPassword } from '../../common/validators/strong-password.decorator.js';

export class RegisterApplicationDto {
  @IsUUID()
  declare membershipTypeId: string;

  @IsString()
  @MinLength(2)
  declare fullName: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StructuredAddressDto)
  declare address?: StructuredAddressDto;

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
  @MinLength(1)
  declare firstName: string;

  @IsString()
  @MinLength(1)
  declare lastName: string;

  @IsEmail()
  declare email: string;

  @StrongPassword()
  declare password: string;

  @IsOptional()
  @IsString()
  declare phone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StructuredAddressDto)
  declare address?: StructuredAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterApplicationDto)
  declare application?: RegisterApplicationDto;
}
