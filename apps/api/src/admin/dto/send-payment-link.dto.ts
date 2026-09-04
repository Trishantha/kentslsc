import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SendMembershipPaymentLinkDto {
  @IsOptional()
  @IsIn(['subscription', 'instalments'])
  declare paymentPlan?: 'subscription' | 'instalments';

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(12)
  declare instalmentCount?: number;
}
