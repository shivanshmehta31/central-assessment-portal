import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ResultsService } from './results.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ResultsController {
  constructor(private results: ResultsService) {}

  @Roles('STUDENT')
  @Get('results/me')
  myResults(@CurrentUser() user: AuthUser) {
    return this.results.myResults(user.profileId);
  }

  @Roles('STUDENT')
  @Get('results/me/:attemptId')
  myResultDetail(@Param('attemptId') attemptId: string, @CurrentUser() user: AuthUser) {
    return this.results.myResultDetail(attemptId, user.profileId);
  }

  @Roles('ADMIN', 'FACULTY')
  @Get('results/assessments/:id')
  assessmentResults(@Param('id') id: string) {
    return this.results.assessmentResults(id);
  }

  @Roles('ADMIN')
  @Post('results/assessments/:id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.results.publish(id, user.userId);
  }

  @Roles('ADMIN')
  @Post('results/attempts/:id/withhold')
  withhold(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.results.withhold(id, user.userId);
  }

  @Roles('ADMIN')
  @Post('results/attempts/:id/override')
  override(@Param('id') id: string, @Body('finalScore') finalScore: number, @CurrentUser() user: AuthUser) {
    return this.results.overrideScore(id, finalScore, user.userId);
  }

  @Roles('ADMIN', 'FACULTY')
  @Get('results/assessments/:id/export.csv')
  async exportCsv(@Param('id') id: string, @Res() res: Response) {
    const csv = await this.results.exportCsv(id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="results-${id}.csv"`);
    res.send(csv);
  }
}
