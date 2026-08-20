import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, IsString, IsUrl, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FundraiserCategory } from '@kentslsc/shared';

export class FundraiserPhotoDto {
  @IsOptional()
  @IsString()
  declare id?: string;

  @IsUrl()
  declare url: string;

  @IsOptional()
  @IsString()
  declare path?: string;
}

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
  @IsString()
  declare imagePath?: string;

  @IsOptional()
  @IsEnum(FundraiserCategory)
  declare category?: FundraiserCategory;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  declare startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  declare endDate?: Date;

  @IsOptional()
  @IsBoolean()
  declare isActive?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FundraiserPhotoDto)
  declare photos?: FundraiserPhotoDto[];
}
