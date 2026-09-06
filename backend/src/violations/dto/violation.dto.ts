import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class OverrideViolationDto {
  @IsIn(['IGNORE', 'REMOVE', 'RESET_COUNT'])
  action!: 'IGNORE' | 'REMOVE' | 'RESET_COUNT';

  @IsOptional() @IsString() note?: string;
}

export class GrantTimeDto {
  @IsInt() minutes!: number;
}
