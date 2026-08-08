import { IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StructuredAddressDto } from '../../auth/dto/address.dto.js';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  declare firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  declare lastName?: string;

  @IsOptional()
  @IsString()
  declare phone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StructuredAddressDto)
  declare address?: StructuredAddressDto;
}
