import { IsString, IsIn } from 'class-validator';

export class ConfirmCheckoutDto {
  @IsString()
  sessionId!: string;

  @IsString()
  @IsIn(['stripe', 'paypal'])
  provider!: 'stripe' | 'paypal';
}
