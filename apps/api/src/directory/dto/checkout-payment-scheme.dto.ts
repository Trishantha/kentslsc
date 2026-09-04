import { IsIn, IsOptional } from 'class-validator';
import type { PaymentMethodOption } from '@kentslsc/shared';

export class CheckoutPaymentSchemeDto {
  @IsOptional()
  @IsIn(['bacs', 'faster_payments'])
  declare paymentScheme?: 'bacs' | 'faster_payments';

  /** Payer's choice of payment method. Omitted = global default provider decides. */
  @IsOptional()
  @IsIn(['card', 'direct_debit', 'instant_bank_pay'])
  declare paymentMethod?: PaymentMethodOption;
}
