import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @IsString() @IsNotEmpty({ message: 'Name is required' }) name!: string;
  @IsString() @IsNotEmpty({ message: 'Code is required' }) code!: string;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Name cannot be empty' }) name?: string;
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Code cannot be empty' }) code?: string;
}

export class CreateCourseDto {
  @IsString() @IsNotEmpty({ message: 'Name is required' }) name!: string;
  @IsString() @IsNotEmpty({ message: 'Code is required' }) code!: string;
  @IsString() @IsNotEmpty({ message: 'Department is required' }) departmentId!: string;
}

export class UpdateCourseDto {
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Name cannot be empty' }) name?: string;
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Code cannot be empty' }) code?: string;
  @IsOptional() @IsString() departmentId?: string;
}

export class CreateSubjectDto {
  @IsString() @IsNotEmpty({ message: 'Subject name is required' }) name!: string;
  // Optional: generated from the name when left blank (e.g. "Cloud Computing" -> "CC").
  @IsOptional() @IsString() code?: string;
  @IsString() @IsNotEmpty({ message: 'Course is required' }) courseId!: string;
  @IsOptional() syllabusUnits?: unknown;
}

export class UpdateSubjectDto {
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Subject name cannot be empty' }) name?: string;
  @IsOptional() @IsString() @IsNotEmpty({ message: 'Subject code cannot be empty' }) code?: string;
  @IsOptional() syllabusUnits?: unknown;
}
