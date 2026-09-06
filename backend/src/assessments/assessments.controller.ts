import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { AssessmentsService } from './assessments.service';
import {
  AssignEvaluatorsDto,
  AssignStudentsDto,
  AttachQuestionsDto,
  CreateAssessmentDto,
  ExtendTimeDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessments')
export class AssessmentsController {
  constructor(private assessments: AssessmentsService) {}

  @Roles('ADMIN', 'FACULTY')
  @Get()
  list(
    @Query('status') status: string | undefined,
    @Query('subjectId') subjectId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    const facultyId = user.role === 'FACULTY' ? user.profileId : undefined;
    return this.assessments.list({ status, subjectId, facultyId });
  }

  @Roles('ADMIN', 'FACULTY')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.assessments.get(id);
  }

  @Roles('ADMIN', 'FACULTY')
  @Get(':id/live-stats')
  liveStats(@Param('id') id: string) {
    return this.assessments.liveStats(id);
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateAssessmentDto, @CurrentUser() user: AuthUser) {
    return this.assessments.create(dto, user.userId);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<UpdateAssessmentDto>, @CurrentUser() user: AuthUser) {
    return this.assessments.update(id, dto, user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/questions')
  attachQuestions(@Param('id') id: string, @Body() dto: AttachQuestionsDto, @CurrentUser() user: AuthUser) {
    return this.assessments.attachQuestions(id, dto.questionIds, user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/assign-students')
  assignStudents(@Param('id') id: string, @Body() dto: AssignStudentsDto, @CurrentUser() user: AuthUser) {
    return this.assessments.assignStudents(id, dto, user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/assign-evaluators')
  assignEvaluators(@Param('id') id: string, @Body() dto: AssignEvaluatorsDto, @CurrentUser() user: AuthUser) {
    return this.assessments.assignEvaluators(id, dto, user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assessments.publish(id, user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assessments.setStatus(id, 'ACTIVE', user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/pause')
  pause(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assessments.setStatus(id, 'PAUSED', user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/resume')
  resume(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assessments.setStatus(id, 'ACTIVE', user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/end')
  end(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assessments.setStatus(id, 'COMPLETED', user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/extend-time')
  extendTime(@Param('id') id: string, @Body() dto: ExtendTimeDto, @CurrentUser() user: AuthUser) {
    return this.assessments.extendTime(id, dto, user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/emergency-terminate')
  terminateAll(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.assessments.terminateAll(id, user.userId);
  }
}
