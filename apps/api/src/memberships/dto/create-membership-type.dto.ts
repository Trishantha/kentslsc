import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, MinLength, Min, IsEnum } from 'class-validator';
import { MembershipFeature } from '@kentslsc/shared';

export class CreateMembershipTypeDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsNumber()
  @Min(0)
  declare price: number;

  @IsBoolean()
  declare isFree: boolean;

  @IsNumber()
  @Min(1)
  declare durationMonths: number;

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
}
