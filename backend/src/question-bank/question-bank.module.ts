import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { DatasetsService } from './datasets.service';
import { DatasetsController } from './datasets.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [QuestionsController, DatasetsController],
  providers: [QuestionsService, DatasetsService],
  exports: [QuestionsService, DatasetsService],
})
export class QuestionBankModule {}
