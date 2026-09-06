import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { FacultyService } from './faculty.service';
import { AssignSubjectsDto, CreateFacultyDto, UpdateFacultyDto } from './dto/faculty.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('faculty')
export class FacultyController {
  constructor(private faculty: FacultyService) {}

  @Roles('ADMIN')
  @Get()
  list(@Query('search') search?: string) {
    return this.faculty.list(search);
  }

  @Roles('ADMIN', 'FACULTY')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.faculty.get(id);
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateFacultyDto, @CurrentUser() user: AuthUser) {
    return this.faculty.create(dto, user.userId);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFacultyDto, @CurrentUser() user: AuthUser) {
    return this.faculty.update(id, dto, user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/subjects')
  assignSubjects(@Param('id') id: string, @Body() dto: AssignSubjectsDto, @CurrentUser() user: AuthUser) {
    return this.faculty.assignSubjects(id, dto.subjectIds, user.userId);
  }

  @Roles('ADMIN')
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.faculty.delete(id, user.userId);
  }

  @Roles('ADMIN')
  @Patch(':id/status/:active')
  setStatus(@Param('id') id: string, @Param('active') active: string, @CurrentUser() user: AuthUser) {
    return this.faculty.setStatus(id, active === 'true', user.userId);
  }

  @Roles('ADMIN')
  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.faculty.resetPassword(id, user.userId);
  }
}
