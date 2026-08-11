import { IsEmail, IsString, MinLength } from 'class-validator';
import { StrongPassword } from '../../common/validators/strong-password.decorator.js';

export class ForgotPasswordDto {
  @IsEmail()
  declare email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  declare token: string;

  @StrongPassword()
  declare password: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  declare currentPassword: string;

  @StrongPassword()
  declare newPassword: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(1)
  declare token: string;
}
