import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

const QUESTION_TYPES = [
  'MCQ',
  'MULTIPLE_SELECT',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'DESCRIPTIVE',
  'CODING',
  'CODE_COMPLETION',
  'CODE_DEBUGGING',
  'CODE_OUTPUT_PREDICTION',
  'DATASET_ANALYSIS',
  'VISUALIZATION_INTERPRETATION',
];

export class QuestionOptionDto {
  @IsString() text!: string;
  @IsBoolean() isCorrect!: boolean;
  @IsOptional() @IsNumber() order?: number;
}

export class TestCaseDto {
  @IsString() input!: string;
  @IsString() expectedOutput!: string;
  @IsOptional() @IsBoolean() isHidden?: boolean;
  @IsOptional() @IsNumber() weight?: number;
}

export class CreateQuestionDto {
  @IsString() title!: string;
  @IsString() description!: string;
  @IsIn(QUESTION_TYPES) type!: string;
  @IsOptional() @IsIn(['EASY', 'MEDIUM', 'HARD']) difficulty?: string;
  @IsString() subjectId!: string;
  @IsString() topic!: string;
  @IsOptional() @IsString() subtopic?: string;
  @IsOptional() @IsNumber() marks?: number;
  @IsOptional() @IsNumber() negativeMarks?: number;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsString() explanation?: string;
  @IsOptional() @IsString() imageUrl?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @IsOptional() @IsString() shortAnswerKey?: string;
  @IsOptional() @IsNumber() characterLimit?: number;
  @IsOptional() @IsNumber() wordLimit?: number;

  @IsOptional() @IsString() starterCode?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() incorrectCode?: string;
  @IsOptional() @IsString() expectedOutput?: string;
  @IsOptional() @IsString() constraints?: string;
  @IsOptional() @IsString() sampleInput?: string;
  @IsOptional() @IsString() sampleOutput?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  testCases?: TestCaseDto[];

  @IsOptional() @IsString() datasetId?: string;
  @IsOptional() @IsArray() allowedLibraries?: string[];
  @IsOptional() @IsBoolean() allowDatasetDownload?: boolean;
}

export class UpdateQuestionDto extends CreateQuestionDto {}

export class QuestionQueryDto {
  @IsOptional() @IsString() subjectId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(QUESTION_TYPES) type?: string;
  @IsOptional() @IsIn(['EASY', 'MEDIUM', 'HARD']) difficulty?: string;
  @IsOptional() @IsString() topic?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) pageSize?: number;
}
