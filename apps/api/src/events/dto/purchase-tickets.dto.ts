import { IsIn, IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class PurchaseTicketsDto {
  @IsUUID()
  declare eventId: string;

  @IsInt()
  @Min(1)
  @Max(10)
  declare quantity: number;

  @IsOptional()
  @IsIn(['bacs', 'faster_payments'])
  declare paymentScheme?: 'bacs' | 'faster_payments';
}
