import { IsOptional, IsString, IsEmail, IsBoolean, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateJobAdDto {
  @IsUUID()
  declare businessListingId: string;

  @IsString()
  declare title: string;

  @IsOptional()
  @IsString()
  declare description?: string;

  @IsOptional()
  @IsString()
  declare location?: string;

  @IsOptional()
  @IsString()
  declare salaryRange?: string;

  @IsOptional()
  @IsEmail()
  declare contactEmail?: string;

  @IsOptional()
  @Type(() => Date)
  declare closingDate?: Date;

  @IsOptional()
  @IsBoolean()
  declare isPublished?: boolean;
}
