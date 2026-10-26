import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { MAX_UPLOAD_BYTES } from '../files/file-type.util';
import { CreateQuestionDto, UpdateQuestionDto } from '../question-bank/dto/question.dto';
import { QuestionPapersService } from './question-papers.service';
import { AnswerSheetsService } from './answer-sheets.service';
import {
  BulkQuestionsDto,
  CreateQuestionPaperDto,
  SaveSheetScoresDto,
  UpdateQuestionPaperDto,
} from './dto/question-paper.dto';

const upload = { limits: { fileSize: MAX_UPLOAD_BYTES } };
// Uploads are buffered in memory, so a batch is capped to keep small hosts safe.
const MAX_BULK_FILES = 25;

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FACULTY')
@Controller('question-papers')
export class QuestionPapersController {
  constructor(private papers: QuestionPapersService) {}

  // Static segments first so they are not captured by ":id".
  @Get('subjects')
  subjects(@CurrentUser() user: AuthUser) {
    return this.papers.subjectsFor(user);
  }

  @Get('students')
  students(@Query('search') search?: string) {
    return this.papers.searchStudents(search);
  }

  @Get('templates/questions.csv')
  templateCsv(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="question-paper-template.csv"');
    res.send(this.papers.templateCsv());
  }

  @Get('templates/questions.xlsx')
  async templateXlsx(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="question-paper-template.xlsx"');
    res.send(await this.papers.templateXlsx());
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.papers.list(user);
  }

  @Post()
  create(@Body() dto: CreateQuestionPaperDto, @CurrentUser() user: AuthUser) {
    return this.papers.create(user, dto);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.papers.get(user, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuestionPaperDto, @CurrentUser() user: AuthUser) {
    return this.papers.update(user, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.papers.remove(user, id);
  }

  // Stores the document as the paper's reference file and returns draft questions to review.
  @Post(':id/parse')
  @UseInterceptors(FileInterceptor('file', upload))
  parse(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    return this.papers.parseUpload(user, id, file);
  }

  @Post(':id/questions/bulk')
  bulkAdd(@Param('id') id: string, @Body() dto: BulkQuestionsDto, @CurrentUser() user: AuthUser) {
    return this.papers.bulkAdd(user, id, dto);
  }

  @Post(':id/questions')
  addQuestion(@Param('id') id: string, @Body() dto: CreateQuestionDto, @CurrentUser() user: AuthUser) {
    return this.papers.addQuestion(user, id, dto);
  }

  @Patch(':id/questions/:questionId')
  updateQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.papers.updateQuestion(user, id, questionId, dto);
  }

  @Delete(':id/questions/:questionId')
  removeQuestion(@Param('id') id: string, @Param('questionId') questionId: string, @CurrentUser() user: AuthUser) {
    return this.papers.removeQuestion(user, id, questionId);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'FACULTY')
@Controller('question-papers/:paperId/answer-sheets')
export class AnswerSheetsController {
  constructor(private sheets: AnswerSheetsService) {}

  @Get()
  list(@Param('paperId') paperId: string, @CurrentUser() user: AuthUser) {
    return this.sheets.list(user, paperId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', upload))
  upload(
    @Param('paperId') paperId: string,
    @Body('studentId') studentId: string | undefined,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sheets.upload(user, paperId, studentId, file);
  }

  @Post('bulk')
  @UseInterceptors(FilesInterceptor('files', MAX_BULK_FILES, upload))
  bulk(@Param('paperId') paperId: string, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() user: AuthUser) {
    return this.sheets.bulkUpload(user, paperId, files);
  }

  @Get(':attemptId')
  detail(@Param('paperId') paperId: string, @Param('attemptId') attemptId: string, @CurrentUser() user: AuthUser) {
    return this.sheets.detail(user, paperId, attemptId);
  }

  @Put(':attemptId/scores')
  saveScores(
    @Param('paperId') paperId: string,
    @Param('attemptId') attemptId: string,
    @Body() dto: SaveSheetScoresDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sheets.saveScores(user, paperId, attemptId, dto);
  }

  @Delete(':attemptId')
  remove(@Param('paperId') paperId: string, @Param('attemptId') attemptId: string, @CurrentUser() user: AuthUser) {
    return this.sheets.remove(user, paperId, attemptId);
  }
}
