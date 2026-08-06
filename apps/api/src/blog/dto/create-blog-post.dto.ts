import { IsBoolean, IsDate, IsOptional, IsString, IsUrl, Matches, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBlogPostDto {
  @IsString()
  @MinLength(1)
  declare title: string;

  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must contain only lowercase letters, numbers and hyphens' })
  declare slug: string;

  @IsString()
  @MinLength(1)
  declare content: string;

  @IsOptional()
  @IsUrl()
  declare imageUrl?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  declare publishedAt?: Date;

  @IsBoolean()
  declare isPublished: boolean;
}
