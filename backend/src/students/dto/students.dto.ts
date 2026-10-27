import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateStudentDto {
  @IsString() @IsNotEmpty({ message: 'Name is required' }) name!: string;
  @IsEmail({}, { message: 'Enter a valid email address' }) email!: string;
  @IsString() @IsNotEmpty({ message: 'Student ID is required' }) studentCode!: string;
  @IsString() @IsNotEmpty({ message: 'Enrollment number is required' }) enrollmentNumber!: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @IsNotEmpty({ message: 'Department is required' }) departmentId!: string;
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @Type(() => Number) @IsInt() semester?: number;
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsString() batch?: string;
  @IsOptional() @IsString() academicYear?: string;
  @IsOptional() @IsString() password?: string; // if omitted, auto-generated
}

export class UpdateStudentDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @Type(() => Number) @IsInt() semester?: number;
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsString() batch?: string;
  @IsOptional() @IsString() academicYear?: string;
}

export class StudentQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() semester?: string;
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsString() batch?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() pageSize?: number;
}

export class BulkStatusDto {
  studentIds!: string[];
  @IsBoolean() activate!: boolean;
}
