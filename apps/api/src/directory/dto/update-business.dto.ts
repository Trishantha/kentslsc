import { IsOptional, IsString, IsUrl, IsEmail, IsBoolean, IsIn } from 'class-validator';
import { directoryCategoryValues } from '@kentslsc/shared';

export class UpdateBusinessListingDto {
  @IsOptional()
  @IsString()
  declare businessName?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  declare logoUrl?: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsOptional()
  @IsString()
  declare servicesText?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  declare websiteUrl?: string;

  @IsOptional()
  @IsEmail()
  declare email?: string;

  @IsOptional()
  @IsString()
  declare phone?: string;

  @IsOptional()
  @IsString()
  declare address?: string;

  @IsOptional()
  @IsString()
  @IsIn(directoryCategoryValues, { message: 'Select a valid category' })
  declare category?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  declare facebook?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  declare instagram?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  declare twitter?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  declare youtube?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  declare linkedin?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  declare tiktok?: string;

  @IsOptional()
  @IsBoolean()
  declare isPaid?: boolean;
}
