import { IsBoolean, IsDate, IsNumber, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFundraiserDto {
  @IsString()
  declare title: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  declare targetAmount: number;

  @IsOptional()
  @IsUrl()
  declare imageUrl?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  declare startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  declare endDate?: Date;

  @IsBoolean()
  declare isActive: boolean;
}
