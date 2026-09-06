import { Module } from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { AttemptsController } from './attempts.controller';
import { AttemptsScheduler } from './attempts.scheduler';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AuditLogsModule, RealtimeModule],
  controllers: [AttemptsController],
  providers: [AttemptsService, AttemptsScheduler],
  exports: [AttemptsService],
})
export class AttemptsModule {}
