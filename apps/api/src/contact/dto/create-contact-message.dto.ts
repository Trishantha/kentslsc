import { IsString, IsOptional, IsEmail, MinLength, IsBoolean } from 'class-validator';

export class CreateContactMessageDto {
  @IsString()
  @MinLength(1)
  declare name: string;

  @IsEmail()
  declare email: string;

  @IsOptional()
  @IsString()
  declare phone?: string;

  @IsString()
  @MinLength(1)
  declare subject: string;

  @IsString()
  @MinLength(10)
  declare message: string;

  @IsBoolean()
  declare consent: boolean;

  @IsOptional()
  @IsString()
  declare website?: string;
}
