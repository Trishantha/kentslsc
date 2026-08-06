import { IsString, MinLength } from 'class-validator';

export class RegenerateCardDto {
  @IsString()
  @MinLength(1)
  declare membershipId: string;
}
