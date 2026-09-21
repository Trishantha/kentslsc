import { IsIn } from 'class-validator';

export class UpdateTicketStatusDto {
  @IsIn(['VALID', 'USED', 'CANCELLED', 'EXPIRED'])
  declare status: 'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED';
}
