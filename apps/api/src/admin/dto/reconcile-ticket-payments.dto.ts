import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ReconcileTicketPaymentsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2160)
  declare lookbackHours?: number;

  @IsOptional()
  @IsBoolean()
  declare onlyUpcomingEvents?: boolean;
}
