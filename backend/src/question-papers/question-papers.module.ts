import { Module } from '@nestjs/common';
import { QuestionPapersService } from './question-papers.service';
import { AnswerSheetsService } from './answer-sheets.service';
import { AnswerSheetsController, QuestionPapersController } from './question-papers.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';
import { QuestionBankModule } from '../question-bank/question-bank.module';

@Module({
  imports: [AuditLogsModule, NotificationsModule, FilesModule, QuestionBankModule],
  controllers: [QuestionPapersController, AnswerSheetsController],
  providers: [QuestionPapersService, AnswerSheetsService],
})
export class QuestionPapersModule {}
