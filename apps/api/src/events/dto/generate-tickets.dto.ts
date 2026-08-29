import { IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class GenerateTicketsDto {
  @IsNumber()
  @Min(1)
  declare quantity: number;

  @IsOptional()
  @IsUUID()
  declare userId?: string;

  @IsOptional()
  @IsUUID()
  declare paymentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  declare prefix?: string;

  @IsOptional()
  @IsString()
  declare notes?: string;
}
