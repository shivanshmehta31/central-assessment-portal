import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFacultyDto {
  @IsString() @IsNotEmpty({ message: 'Name is required' }) name!: string;
  @IsEmail({}, { message: 'Enter a valid email address' }) email!: string;
  @IsString() @IsNotEmpty({ message: 'Faculty ID is required' }) facultyCode!: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @IsNotEmpty({ message: 'Department is required' }) departmentId!: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsArray() subjectIds?: string[];
}

export class UpdateFacultyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() designation?: string;
}

export class AssignSubjectsDto {
  @IsArray() subjectIds!: string[];
}
