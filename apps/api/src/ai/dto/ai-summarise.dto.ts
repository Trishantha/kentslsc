import { IsString, IsOptional, IsInt, MinLength, MaxLength, Min, Max } from 'class-validator';

export class AiSummariseDto {
  // Bounded so an authenticated user can't burn OpenAI credits with an
  // arbitrarily large body. Previously this was an inline object type, which
  // meant the global ValidationPipe had no metatype and skipped it entirely.
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  declare content: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  declare type: string;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(1000)
  declare maxLength?: number;
}
