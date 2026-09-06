import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

const ASSESSMENT_TYPES = [
  'QUIZ',
  'INTERNAL_ASSESSMENT',
  'PRACTICAL_ASSESSMENT',
  'MID_TERM',
  'FINAL_EXAM',
  'MOCK_TEST',
  'PRACTICE_TEST',
];

export class CreateAssessmentDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() subjectId!: string;
  @IsIn(ASSESSMENT_TYPES) type!: string;

  @IsNumber() totalMarks!: number;
  @IsNumber() passingMarks!: number;
  @Type(() => Number) @IsInt() durationMinutes!: number;

  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;

  @IsOptional() @Type(() => Number) @IsInt() maxAttempts?: number;
  @IsOptional() @IsBoolean() allowResume?: boolean;

  @IsOptional() @IsBoolean() randomizeQuestionOrder?: boolean;
  @IsOptional() @IsBoolean() randomizeOptionOrder?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() questionsPerAttempt?: number;

  @IsOptional() @IsIn(['DESKTOP_ONLY', 'DESKTOP_AND_TABLET', 'ALL_DEVICES']) deviceRestriction?: string;
  @IsOptional() @IsBoolean() requireFullscreen?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() violationLimit?: number;
  @IsOptional() @IsIn(['LOG_ONLY', 'WARN', 'AUTO_SUBMIT', 'TERMINATE']) violationAction?: string;

  @IsOptional() @IsBoolean() showResultsImmediately?: boolean;
  @IsOptional() @IsBoolean() showCorrectAnswers?: boolean;

  @IsOptional() @IsString() semester?: string;
  @IsOptional() @IsString() batch?: string;
}

export class UpdateAssessmentDto extends CreateAssessmentDto {}

export class AttachQuestionsDto {
  @IsArray() questionIds!: string[];
}

export class AssignStudentsDto {
  @IsOptional() @IsArray() studentIds?: string[];
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() semester?: string;
  @IsOptional() @IsString() section?: string;
  @IsOptional() @IsString() batch?: string;
}

export class AssignEvaluatorsDto {
  @IsArray() facultyIds!: string[];
}

export class ExtendTimeDto {
  @Type(() => Number) @IsInt() minutes!: number;
  @IsOptional() @IsArray() attemptIds?: string[]; // if omitted, applies to all in-progress attempts
}
