import { IsOptional, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @IsString() name!: string;
  @IsString() code!: string;
}

export class CreateCourseDto {
  @IsString() name!: string;
  @IsString() code!: string;
  @IsString() departmentId!: string;
}

export class CreateSubjectDto {
  @IsString() name!: string;
  @IsString() code!: string;
  @IsString() courseId!: string;
  @IsOptional() syllabusUnits?: unknown;
}
