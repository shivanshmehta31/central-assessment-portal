import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class StartAttemptDto {
  @IsString() assessmentId!: string;
}

export class SaveAnswerDto {
  @IsString() questionId!: string;
  @IsOptional() @IsArray() selectedOptionIds?: string[];
  @IsOptional() @IsString() textAnswer?: string;
  @IsOptional() @IsString() codeAnswer?: string;
  @IsOptional() @IsBoolean() isMarkedForReview?: boolean;
  @IsOptional() @IsIn(['visit']) event?: string; // for timeSpent/visit tracking, extend as needed
}

export class RunCodeDto {
  @IsString() questionId!: string;
  @IsString() code!: string;
}

export class ReportViolationDto {
  @IsIn([
    'TAB_SWITCH',
    'WINDOW_BLUR',
    'FULLSCREEN_EXIT',
    'PAGE_REFRESH',
    'NAVIGATION_ATTEMPT',
    'COPY_PASTE',
    'DEVTOOLS_OPENED',
    'OTHER',
  ])
  type!: string;

  @IsOptional() questionIndexAtTime?: number;
  @IsOptional() remainingTimeSeconds?: number;
  @IsOptional() metadata?: Record<string, unknown>;
}

export class SubmitAttemptDto {
  @IsOptional() @IsString() reason?: string;
}
