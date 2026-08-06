import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  declare title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must contain only lowercase letters, numbers and hyphens' })
  declare slug?: string;

  @IsOptional()
  @IsBoolean()
  declare isHome?: boolean;

  @IsOptional()
  @IsString()
  declare metaDescription?: string;

  @IsOptional()
  declare blocks?: any;

  @IsOptional()
  @IsBoolean()
  declare isPublished?: boolean;
}
