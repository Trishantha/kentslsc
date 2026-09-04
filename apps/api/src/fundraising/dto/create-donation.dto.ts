import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import type { PaymentMethodOption } from '@kentslsc/shared';

export class CreateDonationDto {
  @IsUUID()
  declare fundraiserId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  declare amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  declare displayName?: string;

  @IsOptional()
  @IsBoolean()
  declare isAnonymous?: boolean;

  @IsOptional()
  @IsBoolean()
  declare addProcessingFee?: boolean;

  @IsOptional()
  @IsIn(['bacs', 'faster_payments'])
  declare paymentScheme?: 'bacs' | 'faster_payments';

  /** Donor's choice of payment method. Omitted = global default provider decides. */
  @IsOptional()
  @IsIn(['card', 'direct_debit', 'instant_bank_pay'])
  declare paymentMethod?: PaymentMethodOption;
}
