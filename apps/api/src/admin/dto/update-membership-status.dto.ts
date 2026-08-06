import { IsEnum } from 'class-validator';
import { MembershipStatus } from '@kentslsc/shared';

export class UpdateMembershipStatusDto {
  @IsEnum(MembershipStatus)
  declare status: MembershipStatus;
}
