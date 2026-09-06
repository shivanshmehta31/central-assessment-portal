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
import { parse } from 'csv-parse/sync';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto, QuestionQueryDto, UpdateQuestionDto } from './dto/question.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FACULTY')
@Controller('questions')
export class QuestionsController {
  constructor(private questions: QuestionsService) {}

  @Get()
  list(@Query() query: QuestionQueryDto) {
    return this.questions.list(query);
  }

  @Get('topics/:subjectId')
  topics(@Param('subjectId') subjectId: string) {
    return this.questions.topics(subjectId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.questions.get(id);
  }

  @Post()
  create(@Body() dto: CreateQuestionDto, @CurrentUser() user: AuthUser) {
    const facultyId = user.role === 'FACULTY' ? user.profileId : undefined;
    return this.questions.create(dto, facultyId, user.userId);
  }

  @Post('import/csv')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Query('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const rows = parse(file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, any>[];
    return this.questions.importCsvRows(rows, subjectId, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuestionDto, @CurrentUser() user: AuthUser) {
    return this.questions.update(id, dto, user.userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.questions.delete(id, user.userId);
  }
}
