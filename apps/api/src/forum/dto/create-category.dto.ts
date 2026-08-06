import { IsString, MinLength, IsOptional } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsOptional()
  @IsString()
  declare description?: string;
}
