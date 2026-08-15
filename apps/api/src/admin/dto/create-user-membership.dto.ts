import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { MembershipStatus } from '@kentslsc/shared';

export class AdminCreateMembershipDto {
  @IsUUID()
  declare membershipTypeId: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  declare fullName?: string;

  @IsOptional()
  @IsEnum(MembershipStatus)
  declare status?: MembershipStatus;
}
