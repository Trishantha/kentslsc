import { IsString, IsNumber, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class DependantDto {
  @IsString()
  @Min(1)
  declare name: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(120)
  declare age: number;

  @IsEnum(['spouse', 'child'] as const)
  declare relationship: 'spouse' | 'child';
}
