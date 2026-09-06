import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ViolationSeverityAction, ViolationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AttemptsService } from '../attempts/attempts.service';

@Injectable()
export class ViolationsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private realtime: RealtimeGateway,
    private attempts: AttemptsService,
  ) {}

  async report(
    attemptId: string,
    studentId: string,
    input: {
      type: ViolationType;
      questionIndexAtTime?: number;
      remainingTimeSeconds?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    const attempt = await this.prisma.attemptRecord.findUnique({
      where: { id: attemptId },
      include: { assessment: true, student: { select: { userId: true } } },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.studentId !== studentId) throw new BadRequestException();
    if (attempt.status !== 'IN_PROGRESS') {
      return { violationCount: attempt.violationCount, actionTaken: 'IGNORED', examTerminated: false };
    }

    const newCount = attempt.violationCount + 1;
    const { action, policy } = this.decideAction(attempt.assessment.violationAction, newCount, attempt.assessment.violationLimit);

    await this.prisma.violation.create({
      data: {
        attemptId,
        studentId,
        type: input.type,
        questionIndexAtTime: input.questionIndexAtTime,
        remainingTimeSeconds: input.remainingTimeSeconds,
        actionTaken: action,
        metadata: input.metadata as any,
      },
    });

    await this.prisma.attemptRecord.update({
      where: { id: attemptId },
      data: { violationCount: newCount },
    });

    this.realtime.broadcastViolation(attempt.assessmentId, {
      attemptId,
      studentId,
      type: input.type,
      violationCount: newCount,
      actionTaken: action,
    });

    let examTerminated = false;
    if (action === 'AUTO_SUBMITTED') {
      await this.attempts.finalizeAttempt(attemptId, 'VIOLATION_LIMIT_REACHED', 'AUTO_SUBMITTED');
      examTerminated = true;
    } else if (action === 'TERMINATED') {
      await this.attempts.finalizeAttempt(attemptId, 'VIOLATION_LIMIT_REACHED', 'TERMINATED');
      examTerminated = true;
    }

    await this.auditLogs.record({
      userId: attempt.student.userId,
      role: 'STUDENT',
      action: 'EXAM_VIOLATION',
      entityType: 'AttemptRecord',
      entityId: attemptId,
      metadata: { type: input.type, count: newCount, actionTaken: action },
    });

    return { violationCount: newCount, actionTaken: action, policy, examTerminated };
  }

  private decideAction(
    violationAction: 'LOG_ONLY' | 'WARN' | 'AUTO_SUBMIT' | 'TERMINATE',
    count: number,
    limit: number,
  ): { action: ViolationSeverityAction; policy: { limit: number; violationAction: string } } {
    const policy = { limit, violationAction };
    if (violationAction === 'LOG_ONLY') return { action: 'IGNORED', policy };
    if (violationAction === 'WARN') return { action: 'WARNED', policy };
    if (count >= limit) {
      return { action: violationAction === 'TERMINATE' ? 'TERMINATED' : 'AUTO_SUBMITTED', policy };
    }
    return { action: 'WARNED', policy };
  }

  // ── Admin: Exam Incident Management ──────────────────────────────────────

  async listIncidents(params: { assessmentId?: string; studentId?: string }) {
    return this.prisma.violation.findMany({
      where: {
        attempt: params.assessmentId ? { assessmentId: params.assessmentId } : undefined,
        studentId: params.studentId,
      },
      include: {
        student: { select: { name: true, studentCode: true } },
        attempt: { select: { id: true, status: true, assessmentId: true, assessment: { select: { title: true } } } },
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
  }

  async override(
    violationId: string,
    action: 'IGNORE' | 'REMOVE' | 'RESET_COUNT',
    actorId: string,
    note?: string,
  ) {
    const violation = await this.prisma.violation.findUnique({ where: { id: violationId } });
    if (!violation) throw new NotFoundException('Violation not found');

    await this.prisma.violation.update({
      where: { id: violationId },
      data: { overridden: true, overriddenById: actorId, overriddenAt: new Date(), overrideNote: note },
    });

    if (action === 'RESET_COUNT') {
      await this.prisma.attemptRecord.update({
        where: { id: violation.attemptId },
        data: { violationCount: 0 },
      });
    } else if (action === 'REMOVE') {
      await this.prisma.attemptRecord.update({
        where: { id: violation.attemptId },
        data: { violationCount: { decrement: 1 } },
      });
    }

    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: 'VIOLATION_OVERRIDDEN',
      entityType: 'Violation',
      entityId: violationId,
      metadata: { action, note },
    });

    return { success: true };
  }

  async allowContinue(attemptId: string, actorId: string) {
    const attempt = await this.prisma.attemptRecord.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'TERMINATED' && attempt.status !== 'AUTO_SUBMITTED') {
      throw new BadRequestException('Only terminated or auto-submitted attempts can be reopened');
    }

    const extendedDeadline = new Date(Date.now() + 10 * 60_000);
    await this.prisma.attemptRecord.update({
      where: { id: attemptId },
      data: {
        status: 'IN_PROGRESS',
        submittedAt: null,
        submissionReason: null,
        deadlineAt: extendedDeadline,
        violationCount: 0,
      },
    });

    this.realtime.notifyStudentAssessmentPaused(attempt.studentId, attemptId, false);

    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: 'ATTEMPT_REOPENED',
      entityType: 'AttemptRecord',
      entityId: attemptId,
    });

    return { success: true };
  }

  async resetAttempt(attemptId: string, actorId: string) {
    const attempt = await this.prisma.attemptRecord.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');

    await this.prisma.$transaction([
      this.prisma.violation.deleteMany({ where: { attemptId } }),
      this.prisma.studentAnswer.deleteMany({ where: { attemptId } }),
      this.prisma.attemptRecord.delete({ where: { id: attemptId } }),
    ]);

    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: 'ATTEMPT_RESET',
      entityType: 'AttemptRecord',
      entityId: attemptId,
      metadata: { assessmentId: attempt.assessmentId, studentId: attempt.studentId },
    });

    return { success: true };
  }

  async grantExtraTime(attemptId: string, minutes: number, actorId: string) {
    const attempt = await this.prisma.attemptRecord.findUnique({ where: { id: attemptId } });
    if (!attempt || !attempt.deadlineAt) throw new NotFoundException('Attempt not found');

    const updated = await this.prisma.attemptRecord.update({
      where: { id: attemptId },
      data: {
        extraTimeSeconds: { increment: minutes * 60 },
        deadlineAt: new Date(attempt.deadlineAt.getTime() + minutes * 60_000),
      },
    });

    this.realtime.notifyStudentTimeExtended(attempt.studentId, attemptId, minutes);
    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: 'ATTEMPT_TIME_GRANTED',
      entityType: 'AttemptRecord',
      entityId: attemptId,
      metadata: { minutes },
    });

    return updated;
  }
}
