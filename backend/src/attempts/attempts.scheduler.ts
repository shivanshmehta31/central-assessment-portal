import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AttemptsService } from './attempts.service';

@Injectable()
export class AttemptsScheduler {
  private readonly logger = new Logger('AttemptsScheduler');

  constructor(private attempts: AttemptsService) {}

  // Server-authoritative timer enforcement: never trust the client's clock.
  @Interval(10_000)
  async handleExpiredAttempts() {
    const count = await this.attempts.autoSubmitExpiredAttempts();
    if (count > 0) this.logger.log(`Auto-submitted ${count} expired attempt(s)`);
  }
}
