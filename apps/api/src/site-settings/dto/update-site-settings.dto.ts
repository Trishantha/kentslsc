import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSiteSettingsDto {
  @IsOptional()
  @IsString()
  declare email?: string;

  @IsOptional()
  @IsString()
  declare phone?: string;

  @IsOptional()
  @IsString()
  declare whatsapp?: string;

  @IsOptional()
  @IsString()
  declare address?: string;

  @IsOptional()
  @IsString()
  declare facebook?: string;

  @IsOptional()
  @IsString()
  declare instagram?: string;

  @IsOptional()
  @IsString()
  declare twitter?: string;

  @IsOptional()
  @IsString()
  declare youtube?: string;

  @IsOptional()
  @IsString()
  declare linkedin?: string;

  @IsOptional()
  @IsString()
  declare tiktok?: string;

  @IsOptional()
  @IsBoolean()
  declare showPageLoader?: boolean;
}
