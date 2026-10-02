import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(100)
  username: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class RegisterDto {
  @IsString()
  @MaxLength(100)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(6)
  confirmPassword: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  securityQuestion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  securityAnswer?: string;
}

export class ResetPasswordDto {
  @IsString()
  @MaxLength(100)
  username: string;

  @IsString()
  @MaxLength(200)
  securityAnswer: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
