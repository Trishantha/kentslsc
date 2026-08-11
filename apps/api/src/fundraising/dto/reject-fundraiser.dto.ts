import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectFundraiserDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare reason?: string;
}
