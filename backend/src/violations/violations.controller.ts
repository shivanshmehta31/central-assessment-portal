import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ViolationsService } from './violations.service';
import { ReportViolationDto } from '../attempts/dto/attempt.dto';
import { GrantTimeDto, OverrideViolationDto } from './dto/violation.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ViolationsController {
  constructor(private violations: ViolationsService) {}

  @Roles('STUDENT')
  @Post('attempts/:attemptId/violations')
  report(
    @Param('attemptId') attemptId: string,
    @Body() dto: ReportViolationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.violations.report(attemptId, user.profileId, dto as any);
  }

  @Roles('ADMIN')
  @Get('violations')
  list(@Query('assessmentId') assessmentId?: string, @Query('studentId') studentId?: string) {
    return this.violations.listIncidents({ assessmentId, studentId });
  }

  @Roles('ADMIN')
  @Post('violations/:id/override')
  override(@Param('id') id: string, @Body() dto: OverrideViolationDto, @CurrentUser() user: AuthUser) {
    return this.violations.override(id, dto.action, user.userId, dto.note);
  }

  @Roles('ADMIN')
  @Post('attempts/:id/allow-continue')
  allowContinue(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.violations.allowContinue(id, user.userId);
  }

  @Roles('ADMIN')
  @Post('attempts/:id/reset')
  resetAttempt(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.violations.resetAttempt(id, user.userId);
  }

  @Roles('ADMIN')
  @Post('attempts/:id/grant-time')
  grantTime(@Param('id') id: string, @Body() dto: GrantTimeDto, @CurrentUser() user: AuthUser) {
    return this.violations.grantExtraTime(id, dto.minutes, user.userId);
  }
}
