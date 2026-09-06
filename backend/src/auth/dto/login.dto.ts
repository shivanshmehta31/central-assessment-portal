import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  identifier!: string; // email (admin/faculty) or student code / enrollment number (student)

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsIn(['ADMIN', 'FACULTY', 'STUDENT'])
  expectedRole?: 'ADMIN' | 'FACULTY' | 'STUDENT';
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsString()
  identifier!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
