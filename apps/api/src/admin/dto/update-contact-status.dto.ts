import { IsEnum } from 'class-validator';
import { ContactStatus } from '@kentslsc/shared';

export class UpdateContactStatusDto {
  @IsEnum(ContactStatus)
  declare status: ContactStatus;
}
