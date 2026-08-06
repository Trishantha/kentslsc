import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateDonationDto {
  @IsUUID()
  declare fundraiserId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  declare amount: number;

  @IsOptional()
  @IsString()
  declare message?: string;
}
