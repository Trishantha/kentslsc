import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, IsEmail, IsBoolean, IsIn } from 'class-validator';
import { directoryCategoryValues } from '@kentslsc/shared';

export class UpdateBusinessListingDto {
  @IsOptional()
  @IsString()
  declare businessName?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @Transform(({ value }) => (value === '' ? undefined : value))
  declare logoUrl?: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsOptional()
  @IsString()
  declare servicesText?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @Transform(({ value }) => (value === '' ? undefined : value))
  declare websiteUrl?: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => (value === '' ? undefined : value))
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
  @Transform(({ value }) => (value === '' ? undefined : value))
  declare category?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @Transform(({ value }) => (value === '' ? undefined : value))
  declare facebook?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @Transform(({ value }) => (value === '' ? undefined : value))
  declare instagram?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @Transform(({ value }) => (value === '' ? undefined : value))
  declare twitter?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @Transform(({ value }) => (value === '' ? undefined : value))
  declare youtube?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @Transform(({ value }) => (value === '' ? undefined : value))
  declare linkedin?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @Transform(({ value }) => (value === '' ? undefined : value))
  declare tiktok?: string;

  @IsOptional()
  @IsBoolean()
  declare isPaid?: boolean;
}
