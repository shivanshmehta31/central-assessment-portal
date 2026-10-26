import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

const ASSESSMENT_TYPES = ['QUIZ', 'INTERNAL_ASSESSMENT', 'PRACTICAL_ASSESSMENT', 'MID_TERM', 'FINAL_EXAM', 'MOCK_TEST', 'PRACTICE_TEST'];
const QUESTION_TYPES = [
  'MCQ', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'SHORT_ANSWER', 'DESCRIPTIVE', 'CODING', 'CODE_COMPLETION',
  'CODE_DEBUGGING', 'CODE_OUTPUT_PREDICTION', 'DATASET_ANALYSIS', 'VISUALIZATION_INTERPRETATION',
];

export class CreateQuestionPaperDto {
  @IsString() title!: string;
  @IsString() subjectId!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(ASSESSMENT_TYPES) type?: string;
  @IsOptional() @IsNumber() @Min(0) passingMarks?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationMinutes?: number;
  @IsOptional() @IsDateString() examDate?: string;
}

export class UpdateQuestionPaperDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(ASSESSMENT_TYPES) type?: string;
  @IsOptional() @IsNumber() @Min(0) passingMarks?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationMinutes?: number;
  @IsOptional() @IsDateString() examDate?: string;
}

export class DraftOptionDto {
  @IsString() text!: string;
  @IsBoolean() isCorrect!: boolean;
}

export class QuestionDraftDto {
  @IsString() title!: string;
  @IsString() description!: string;
  @IsIn(QUESTION_TYPES) type!: string;
  @IsNumber() marks!: number;
  @IsOptional() @IsNumber() negativeMarks?: number;
  @IsOptional() @IsString() topic?: string;
  @IsOptional() @IsIn(['EASY', 'MEDIUM', 'HARD']) difficulty?: string;
  @IsOptional() @IsString() explanation?: string;
  @IsOptional() @IsString() shortAnswerKey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftOptionDto)
  options?: DraftOptionDto[];
}

export class BulkQuestionsDto {
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => QuestionDraftDto)
  drafts!: QuestionDraftDto[];
}

export class SheetScoreDto {
  @IsString() questionId!: string;
  @IsNumber() @Min(0) score!: number;
  @IsOptional() @IsString() feedback?: string;
}

export class SaveSheetScoresDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SheetScoreDto)
  scores!: SheetScoreDto[];

  @IsOptional() @IsBoolean() finalize?: boolean;
}
