import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { MembershipStatus } from '@kentslsc/shared';

export class UpdateMembershipStatusDto {
  @IsEnum(MembershipStatus)
  declare status: MembershipStatus;

  // Required to activate a paid membership that has not actually been paid
  // (e.g. recording an offline payment). Prevents accidentally marking an
  // unpaid application as paid when approving it.
  @IsOptional()
  @IsBoolean()
  declare confirmManualPayment?: boolean;
}
