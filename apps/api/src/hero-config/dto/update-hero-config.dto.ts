import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateHeroConfigDto {
  @IsOptional()
  @IsString()
  @IsIn(['video', 'image'])
  declare mediaType?: string;

  @IsOptional()
  @IsString()
  declare imageUrl?: string;

  @IsOptional()
  @IsString()
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
