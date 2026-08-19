import { IsString, MinLength } from 'class-validator';

export class CreateMembershipScanDto {
  @IsString()
  @MinLength(1)
  declare qrCodeValue: string;
}
