import { IsOptional, IsString, IsIn, IsUrl } from 'class-validator';

const ALLOWED_PAYPAL_URLS = [
  'https://api-m.sandbox.paypal.com',
  'https://api-m.paypal.com'
];

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
  @IsUrl()
  @IsIn(ALLOWED_PAYPAL_URLS, { message: 'PAYPAL_API_BASE_URL must be an official PayPal API host' })
  declare paypalApiBaseUrl?: string;
}
