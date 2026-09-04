import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { PaymentMethodOption } from '@kentslsc/shared';

export class SendMembershipPaymentLinkDto {
  @IsOptional()
  @IsIn(['subscription', 'instalments'])
  declare paymentPlan?: 'subscription' | 'instalments';

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(12)
  declare instalmentCount?: number;

  /** 'card' sends the Stripe subscription checkout; 'direct_debit' (or omitted) the GoCardless branch. */
  @IsOptional()
  @IsIn(['card', 'direct_debit', 'instant_bank_pay'])
  declare paymentMethod?: PaymentMethodOption;
}
