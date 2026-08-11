import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateFundraiserUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare title: string;

  @IsString()
  @MinLength(1)
  declare content: string;
}
