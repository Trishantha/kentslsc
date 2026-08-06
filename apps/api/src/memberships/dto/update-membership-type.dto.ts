import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, MinLength, Min } from 'class-validator';

export class UpdateMembershipTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  declare name?: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  declare price?: number;

  @IsOptional()
  @IsBoolean()
  declare isFree?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  declare durationMonths?: number;

  @IsOptional()
  @IsString({ each: true })
  @IsArray()
  declare benefits?: string[];
}
