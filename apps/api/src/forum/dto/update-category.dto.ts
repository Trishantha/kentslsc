import { IsString, MinLength, IsOptional } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  declare name?: string;

  @IsOptional()
  @IsString()
  declare description?: string;
}
