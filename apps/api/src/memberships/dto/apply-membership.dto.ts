import { IsString, IsOptional, IsArray, ValidateNested, MinLength, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { DependantDto } from './dependant.dto.js';
import { StructuredAddressDto } from '../../auth/dto/address.dto.js';

export class ApplyMembershipDto {
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DependantDto)
  declare dependants?: DependantDto[];
}
