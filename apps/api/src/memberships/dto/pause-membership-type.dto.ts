import { IsUUID } from 'class-validator';

export class PauseMembershipTypeDto {
  @IsUUID()
  declare targetMembershipTypeId: string;
}
