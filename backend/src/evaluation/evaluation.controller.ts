import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { EvaluationService } from './evaluation.service';
import { ScoreAnswerDto } from './dto/evaluation.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FACULTY')
@Controller('evaluation')
export class EvaluationController {
  constructor(private evaluation: EvaluationService) {}

  @Get('assessments')
  myAssessments(@CurrentUser() user: AuthUser) {
    return this.evaluation.myAssessments(user.profileId);
  }

  @Get('assessments/:id/attempts')
  attemptsForAssessment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.evaluation.attemptsForAssessment(id, user.profileId);
  }

  @Get('attempts/:id')
  getAttempt(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.evaluation.getAttemptForGrading(id, user.profileId);
  }

  @Post('answers/:id/score')
  scoreAnswer(@Param('id') id: string, @Body() dto: ScoreAnswerDto, @CurrentUser() user: AuthUser) {
    return this.evaluation.scoreAnswer(id, dto.score, dto.feedback, user.profileId);
  }

  @Post('attempts/:id/finalize')
  finalize(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.evaluation.finalizeAttempt(id, user.profileId);
  }
}
