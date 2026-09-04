import { IsIn, IsOptional } from 'class-validator';

export class CheckoutPaymentSchemeDto {
  @IsOptional()
  @IsIn(['bacs', 'faster_payments'])
  declare paymentScheme?: 'bacs' | 'faster_payments';
}
