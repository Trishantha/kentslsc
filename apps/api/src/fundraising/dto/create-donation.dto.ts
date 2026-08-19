import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateDonationDto {
  @IsUUID()
  declare fundraiserId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  declare amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare displayName?: string;

  @IsOptional()
  @IsBoolean()
  declare isAnonymous?: boolean;

  @IsOptional()
  @IsBoolean()
  declare addProcessingFee?: boolean;
}
