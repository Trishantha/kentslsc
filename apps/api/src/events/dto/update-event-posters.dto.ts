import { IsString, IsOptional, IsUrl, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PosterImageDto {
  @IsUrl()
  declare url: string;

  @IsOptional()
  @IsString()
  declare caption?: string;
}

export class UpdateEventPostersDto {
  @IsOptional()
  @IsUrl()
  declare posterImageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosterImageDto)
  declare posterImages?: PosterImageDto[];
}
