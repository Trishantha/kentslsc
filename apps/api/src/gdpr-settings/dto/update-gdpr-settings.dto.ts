import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGdprSettingsDto {
  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  cookieConsentEnabled?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  cookieConsentMessage?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  cookiePolicyUrl?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  privacyPolicyUrl?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  analyticsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  marketingCookiesEnabled?: boolean;

  @ApiPropertyOptional()
  @IsInt()
  @Min(30)
  @Max(3650)
  @IsOptional()
  dataRetentionDays?: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  dpoName?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  dpoEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(50)
  @IsOptional()
  dpoPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  gdprNotes?: string;
}
