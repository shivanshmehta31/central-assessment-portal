import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ScoreAnswerDto {
  @IsNumber() score!: number;
  @IsOptional() @IsString() feedback?: string;
}
