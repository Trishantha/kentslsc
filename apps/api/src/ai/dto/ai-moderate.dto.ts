import { IsString, MinLength, MaxLength } from 'class-validator';

export class AiModerateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  declare content: string;
}
