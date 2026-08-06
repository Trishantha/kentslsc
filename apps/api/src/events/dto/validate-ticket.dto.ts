import { IsString, MinLength } from 'class-validator';

export class ValidateTicketDto {
  @IsString()
  @MinLength(1)
  declare qrCodeValue: string;
}
