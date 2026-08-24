import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MinLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MembershipStatus } from '@kentslsc/shared';
import { DependantDto } from '../../memberships/dto/dependant.dto.js';

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

  @IsOptional()
  @IsIn(['online', 'offline'])
  declare paymentMode?: 'online' | 'offline';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DependantDto)
  declare dependants?: DependantDto[];
}
