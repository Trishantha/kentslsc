import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsString()
  @IsIn(['stripe', 'paypal'], { message: 'Provider must be stripe or paypal' })
  declare provider?: 'stripe' | 'paypal';

  @IsOptional()
  @IsString()
  declare stripeSecretKey?: string;

  @IsOptional()
  @IsString()
  declare stripeWebhookSecret?: string;

  @IsOptional()
  @IsString()
  declare stripePublishableKey?: string;

  @IsOptional()
  @IsString()
  declare paypalClientId?: string;

  @IsOptional()
  @IsString()
  declare paypalClientSecret?: string;

  @IsOptional()
  @IsString()
  declare paypalApiBaseUrl?: string;
}
