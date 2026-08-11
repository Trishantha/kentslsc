import { IsDate, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordOfflineDonationDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  declare amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare message?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  declare donatedAt?: Date;
}
