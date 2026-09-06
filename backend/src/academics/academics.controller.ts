import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AcademicsService } from './academics.service';
import { CreateCourseDto, CreateDepartmentDto, CreateSubjectDto } from './dto/academics.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AcademicsController {
  constructor(private academics: AcademicsService) {}

  @Get('departments')
  listDepartments() {
    return this.academics.listDepartments();
  }

  @Roles('ADMIN')
  @Post('departments')
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.academics.createDepartment(dto);
  }

  @Roles('ADMIN')
  @Patch('departments/:id')
  updateDepartment(@Param('id') id: string, @Body() dto: Partial<CreateDepartmentDto>) {
    return this.academics.updateDepartment(id, dto);
  }

  @Roles('ADMIN')
  @Delete('departments/:id')
  deleteDepartment(@Param('id') id: string) {
    return this.academics.deleteDepartment(id);
  }

  @Get('courses')
  listCourses(@Query('departmentId') departmentId?: string) {
    return this.academics.listCourses(departmentId);
  }

  @Roles('ADMIN')
  @Post('courses')
  createCourse(@Body() dto: CreateCourseDto) {
    return this.academics.createCourse(dto);
  }

  @Roles('ADMIN')
  @Patch('courses/:id')
  updateCourse(@Param('id') id: string, @Body() dto: Partial<CreateCourseDto>) {
    return this.academics.updateCourse(id, dto);
  }

  @Roles('ADMIN')
  @Delete('courses/:id')
  deleteCourse(@Param('id') id: string) {
    return this.academics.deleteCourse(id);
  }

  @Get('subjects')
  listSubjects(@Query('courseId') courseId?: string) {
    return this.academics.listSubjects(courseId);
  }

  @Get('subjects/:id')
  getSubject(@Param('id') id: string) {
    return this.academics.getSubject(id);
  }

  @Roles('ADMIN')
  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.academics.createSubject(dto);
  }

  @Roles('ADMIN')
  @Patch('subjects/:id')
  updateSubject(@Param('id') id: string, @Body() dto: Partial<CreateSubjectDto>) {
    return this.academics.updateSubject(id, dto);
  }

  @Roles('ADMIN')
  @Delete('subjects/:id')
  deleteSubject(@Param('id') id: string) {
    return this.academics.deleteSubject(id);
  }
}
