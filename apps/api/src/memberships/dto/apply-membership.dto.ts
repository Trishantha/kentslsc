import { IsString, IsOptional, IsArray, ValidateNested, MinLength, IsUUID, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import type { PaymentMethodOption } from '@kentslsc/shared';
import { DependantDto } from './dependant.dto.js';
import { StructuredAddressDto } from '../../auth/dto/address.dto.js';

export class ApplyMembershipDto {
  @IsUUID()
  declare membershipTypeId: string;

  @IsString()
  @MinLength(2)
  declare fullName: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => StructuredAddressDto)
  declare address?: StructuredAddressDto;

  @IsOptional()
  @IsString()
  declare phone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DependantDto)
  declare dependants?: DependantDto[];

  /** Applicant's preferred payment method. Omitted = today's behaviour. */
  @IsOptional()
  @IsIn(['card', 'direct_debit', 'instant_bank_pay'])
  declare paymentMethod?: PaymentMethodOption;
}
