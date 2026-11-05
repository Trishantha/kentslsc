import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
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

  /**
   * Email the tickets are delivered to. Required when the buyer is not logged
   * in; optional for logged-in buyers who want the tickets sent to a different
   * address (e.g. buying for someone else).
   */
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  declare buyerEmail?: string;

  /** Display name recorded for a guest buyer (optional). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare buyerName?: string;
}
