import { IsString, IsOptional, IsNumber, IsBoolean, IsUrl, IsDateString, Min } from 'class-validator';

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
  @IsNumber()
  declare maxTickets?: number;

  @IsOptional()
  @IsUrl()
  declare imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  declare isPublished?: boolean;
}
