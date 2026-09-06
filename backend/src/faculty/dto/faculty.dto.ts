import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateFacultyDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsString() facultyCode!: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() departmentId!: string;
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
