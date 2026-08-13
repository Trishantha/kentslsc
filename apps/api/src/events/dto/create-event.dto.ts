import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUrl,
  IsDateString,
  IsEnum,
  Min
} from 'class-validator';
import { EventCategory } from '@kentslsc/shared';

export class CreateEventDto {
  @IsString()
  declare title: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsOptional()
  @IsString()
  declare location?: string;

  @IsDateString()
  declare startDatetime: string;

  @IsDateString()
  declare endDatetime: string;

  @IsNumber()
  @Min(0)
  declare ticketPrice: number;

  @IsOptional()
  @IsBoolean()
  declare isFree?: boolean;

  @IsOptional()
  @IsNumber()
  declare maxTickets?: number;

  @IsOptional()
  @IsEnum(EventCategory)
  declare category?: EventCategory;

  @IsOptional()
  @IsUrl()
  declare imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  declare isPublished?: boolean;
}
