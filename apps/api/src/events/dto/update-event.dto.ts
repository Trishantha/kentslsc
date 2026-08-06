import { IsString, IsOptional, IsNumber, IsBoolean, IsUrl, IsDateString, Min } from 'class-validator';

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
  @IsNumber()
  declare maxTickets?: number;

  @IsOptional()
  @IsUrl()
  declare imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  declare isPublished?: boolean;
}
