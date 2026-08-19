import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class UpdateHeroConfigDto {
  @IsOptional()
  @IsString()
  @IsIn(['video', 'image'])
  declare mediaType?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  declare imageUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  declare videoUrl?: string;

  @IsOptional()
  @IsString()
  declare overlayStyle?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  declare overlayOpacity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  declare videoOverlayOpacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(4)
  declare videoPlaybackRate?: number;
}
