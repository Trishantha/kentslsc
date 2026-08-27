import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectMembershipDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  declare reason?: string;
}
