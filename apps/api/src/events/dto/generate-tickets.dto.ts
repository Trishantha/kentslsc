import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class GenerateTicketsDto {
  @IsNumber()
  @Min(1)
  declare quantity: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  declare prefix?: string;

  @IsOptional()
  @IsString()
  declare notes?: string;
}
