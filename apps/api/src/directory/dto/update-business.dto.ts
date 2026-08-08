import { IsOptional, IsString, IsUrl, IsEmail, IsBoolean } from 'class-validator';

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
  declare category?: string;

  @IsOptional()
  @IsBoolean()
  declare isPaid?: boolean;
}
