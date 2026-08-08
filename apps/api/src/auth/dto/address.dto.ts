import { IsString, IsOptional, MinLength } from 'class-validator';

export class StructuredAddressDto {
  @IsString()
  @MinLength(1)
  declare buildingStreet: string;

  @IsOptional()
  @IsString()
  declare locality?: string;

  @IsString()
  @MinLength(1)
  declare townCity: string;

  @IsString()
  @MinLength(1)
  declare postcode: string;
}
