import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, MinLength, Min, IsEnum, IsInt } from 'class-validator';
import { MembershipFeature } from '@kentslsc/shared';

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
  @IsInt()
  @Min(1)
  declare maxIssuances?: number;

  @IsOptional()
  @IsString({ each: true })
  @IsArray()
  declare benefits?: string[];

  @IsOptional()
  @IsEnum(MembershipFeature, { each: true })
  @IsArray()
  declare features?: MembershipFeature[];

  @IsOptional()
  @IsBoolean()
  declare autoActivate?: boolean;

  @IsOptional()
  @IsBoolean()
  declare grantsMemberRole?: boolean;
}
