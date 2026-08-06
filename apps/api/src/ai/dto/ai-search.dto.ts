import { IsString, IsOptional, IsInt, MinLength, Min, Max } from 'class-validator';

export class AiSearchDto {
  @IsString()
  @MinLength(1)
  declare query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  declare limit?: number;
}
