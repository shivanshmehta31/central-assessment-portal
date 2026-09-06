import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { AttemptsService } from './attempts.service';
import { SaveAnswerDto, StartAttemptDto } from './dto/attempt.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STUDENT')
@Controller('attempts')
export class AttemptsController {
  constructor(private attempts: AttemptsService) {}

  @Get('available')
  available(@CurrentUser() user: AuthUser) {
    return this.attempts.availableForStudent(user.profileId);
  }

  @Get('instructions/:assessmentId')
  instructions(@Param('assessmentId') assessmentId: string, @CurrentUser() user: AuthUser) {
    return this.attempts.instructions(assessmentId, user.profileId);
  }

  @Post('start')
  start(@Body() dto: StartAttemptDto, @CurrentUser() user: AuthUser) {
    return this.attempts.start(user.profileId, dto.assessmentId);
  }

  @Get(':id')
  getState(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.getState(id, user.profileId);
  }

  @Post(':id/save-answer')
  saveAnswer(@Param('id') id: string, @Body() dto: SaveAnswerDto, @CurrentUser() user: AuthUser) {
    return this.attempts.saveAnswer(id, user.profileId, dto);
  }

  @Post(':id/navigate/:index')
  navigate(@Param('id') id: string, @Param('index') index: string, @CurrentUser() user: AuthUser) {
    return this.attempts.navigate(id, user.profileId, Number(index));
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.submit(id, user.profileId);
  }
}
