import { IsString, IsOptional, IsBoolean, IsDate, IsUrl, IsArray, ValidateNested, Matches, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class GalleryPhotoDto {
  @IsOptional()
  @IsString()
  declare id?: string;

  @IsUrl()
  declare url: string;

  @IsOptional()
  @IsString()
  declare path?: string;

  @IsOptional()
  @IsString()
  declare caption?: string;
}

export class CreateGalleryDto {
  @IsString()
  @MinLength(1)
  declare title: string;

  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must contain only lowercase letters, numbers and hyphens' })
  declare slug: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  declare eventDate?: Date;

  @IsOptional()
  @IsBoolean()
  declare isPublished?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GalleryPhotoDto)
  declare photos?: GalleryPhotoDto[];
}
