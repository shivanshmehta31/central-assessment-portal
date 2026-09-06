import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FACULTY')
@Controller('analytics')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Roles('ADMIN')
  @Get('overview')
  overview() {
    return this.analytics.overview();
  }

  @Get('assessments/:id')
  assessmentAnalytics(@Param('id') id: string) {
    return this.analytics.assessmentAnalytics(id);
  }

  @Get('assessments/:id/questions')
  questionAnalytics(@Param('id') id: string) {
    return this.analytics.questionAnalytics(id);
  }

  @Get('assessments/:id/live')
  liveMonitoring(@Param('id') id: string) {
    return this.analytics.liveMonitoring(id);
  }

  @Get('subjects/:id/topics')
  topicAnalysis(@Param('id') id: string) {
    return this.analytics.topicAnalysis(id);
  }
}
