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
import { Transform } from 'class-transformer';
import { EventCategory, EventRegistrationMode } from '@kentslsc/shared';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  declare title?: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsOptional()
  @IsString()
  declare location?: string;

  @IsOptional()
  @IsDateString()
  declare startDatetime?: string;

  @IsOptional()
  @IsDateString()
  declare endDatetime?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  declare ticketPrice?: number;

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
  @IsEnum(EventRegistrationMode)
  declare registrationMode?: EventRegistrationMode;

  @IsOptional()
  @IsUrl()
  declare imageUrl?: string;

  @IsOptional()
  @IsUrl()
  @Transform(({ value }) => (value === '' ? undefined : value))
  declare externalTicketingUrl?: string;

  @IsOptional()
  @IsBoolean()
  declare isPublished?: boolean;
}
