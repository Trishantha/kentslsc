import { IsIn, IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';
import type { PaymentMethodOption } from '@kentslsc/shared';

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

  /** Payer's choice of payment method. Omitted = global default provider decides. */
  @IsOptional()
  @IsIn(['card', 'direct_debit', 'instant_bank_pay'])
  declare paymentMethod?: PaymentMethodOption;
}
