import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { StudentsService } from './students.service';
import { BulkStatusDto, CreateStudentDto, StudentQueryDto, UpdateStudentDto } from './dto/students.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('students')
export class StudentsController {
  constructor(private students: StudentsService) {}

  @Get()
  list(@Query() query: StudentQueryDto) {
    return this.students.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.students.get(id);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.students.assessmentHistory(id);
  }

  @Post()
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: AuthUser) {
    return this.students.create(dto, user.userId);
  }

  @Post('import/csv')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    const rows = this.students.parseCsvBuffer(file.buffer);
    return this.students.bulkImport(rows, user.userId);
  }

  @Post('import/excel')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    const rows = await this.students.parseExcelBuffer(file.buffer);
    return this.students.bulkImport(rows, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto, @CurrentUser() user: AuthUser) {
    return this.students.update(id, dto, user.userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.students.delete(id, user.userId);
  }

  @Patch(':id/status/:active')
  setStatus(
    @Param('id') id: string,
    @Param('active') active: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.students.setStatus(id, active === 'true', user.userId);
  }

  @Post('bulk-status')
  bulkStatus(@Body() dto: BulkStatusDto, @CurrentUser() user: AuthUser) {
    return this.students.bulkSetStatus(dto.studentIds, dto.activate, user.userId);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.students.resetPassword(id, user.userId);
  }
}
