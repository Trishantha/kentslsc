import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSiteSeoSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(70)
  declare metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  declare metaDescription?: string;

  @IsOptional()
  @IsString()
  declare metaKeywords?: string;
}
