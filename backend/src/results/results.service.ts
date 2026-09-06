import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ResultsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private notifications: NotificationsService,
  ) {}

  async myResults(studentId: string) {
    const attempts = await this.prisma.attemptRecord.findMany({
      where: { studentId, resultStatus: 'PUBLISHED' },
      include: { assessment: { select: { title: true, totalMarks: true, passingMarks: true, subject: true } } },
      orderBy: { submittedAt: 'desc' },
    });

    return attempts.map((a) => ({
      attemptId: a.id,
      assessmentTitle: a.assessment.title,
      subject: a.assessment.subject.name,
      totalMarks: a.assessment.totalMarks,
      obtainedMarks: a.finalScore,
      percentage: a.finalScore != null ? Math.round((a.finalScore / a.assessment.totalMarks) * 1000) / 10 : null,
      passed: a.finalScore != null ? a.finalScore >= a.assessment.passingMarks : null,
      submittedAt: a.submittedAt,
    }));
  }

  async myResultDetail(attemptId: string, studentId: string) {
    const attempt = await this.prisma.attemptRecord.findUnique({
      where: { id: attemptId },
      include: {
        assessment: true,
        answers: { include: { question: { include: { options: true } } } },
      },
    });
    if (!attempt) throw new NotFoundException('Result not found');
    if (attempt.studentId !== studentId) throw new ForbiddenException();
    if (attempt.resultStatus !== 'PUBLISHED') throw new ForbiddenException('Result has not been published yet');

    const topicScores = new Map<string, { obtained: number; max: number }>();
    for (const answer of attempt.answers) {
      const topic = answer.question.topic;
      const entry = topicScores.get(topic) ?? { obtained: 0, max: 0 };
      entry.max += answer.question.marks;
      entry.obtained += (answer.autoScore ?? 0) + (answer.manualScore ?? 0);
      topicScores.set(topic, entry);
    }

    return {
      assessment: {
        title: attempt.assessment.title,
        totalMarks: attempt.assessment.totalMarks,
        passingMarks: attempt.assessment.passingMarks,
      },
      obtainedMarks: attempt.finalScore,
      percentage: attempt.finalScore != null ? Math.round((attempt.finalScore / attempt.assessment.totalMarks) * 1000) / 10 : null,
      passed: attempt.finalScore != null ? attempt.finalScore >= attempt.assessment.passingMarks : null,
      submittedAt: attempt.submittedAt,
      topicPerformance: [...topicScores.entries()].map(([topic, { obtained, max }]) => ({
        topic,
        percentage: max ? Math.round((obtained / max) * 1000) / 10 : 0,
      })),
      answers: attempt.assessment.showCorrectAnswers
        ? attempt.answers.map((a) => ({
            question: a.question.title,
            yourAnswer: a.selectedOptionIds.length
              ? a.question.options.filter((o) => a.selectedOptionIds.includes(o.id)).map((o) => o.text)
              : a.textAnswer ?? a.codeAnswer,
            correctAnswer: a.question.options.filter((o) => o.isCorrect).map((o) => o.text),
            explanation: a.question.explanation,
            marksAwarded: (a.autoScore ?? 0) + (a.manualScore ?? 0),
            maxMarks: a.question.marks,
          }))
        : null,
    };
  }

  // ── Admin: publish / withhold ─────────────────────────────────────────────

  async assessmentResults(assessmentId: string) {
    const attempts = await this.prisma.attemptRecord.findMany({
      where: { assessmentId, status: { not: 'IN_PROGRESS' } },
      include: { student: { select: { name: true, studentCode: true, section: true, batch: true } } },
      orderBy: { finalScore: 'desc' },
    });
    return attempts;
  }

  async publish(assessmentId: string, actorId: string) {
    const attempts = await this.prisma.attemptRecord.findMany({
      where: { assessmentId, resultStatus: 'EVALUATED' },
    });
    if (!attempts.length) throw new BadRequestException('No fully evaluated results to publish yet');

    await this.prisma.attemptRecord.updateMany({
      where: { id: { in: attempts.map((a) => a.id) } },
      data: { resultStatus: 'PUBLISHED' },
    });

    await this.notifications.notifyMany(
      attempts.map((a) => a.studentId),
      'STUDENT',
      'RESULT_PUBLISHED',
      'Result published',
      'Your examination result has been published. You can now view it from your dashboard.',
      { assessmentId },
    );

    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: 'RESULTS_PUBLISHED',
      entityType: 'Assessment',
      entityId: assessmentId,
      metadata: { count: attempts.length },
    });

    return { success: true, published: attempts.length };
  }

  async withhold(attemptId: string, actorId: string) {
    await this.prisma.attemptRecord.update({ where: { id: attemptId }, data: { resultStatus: 'WITHHELD' } });
    await this.auditLogs.record({ userId: actorId, role: 'ADMIN', action: 'RESULT_WITHHELD', entityType: 'AttemptRecord', entityId: attemptId });
    return { success: true };
  }

  async overrideScore(attemptId: string, finalScore: number, actorId: string) {
    const updated = await this.prisma.attemptRecord.update({
      where: { id: attemptId },
      data: { finalScore },
    });
    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: 'RESULT_SCORE_OVERRIDDEN',
      entityType: 'AttemptRecord',
      entityId: attemptId,
      metadata: { finalScore },
    });
    return updated;
  }

  async exportCsv(assessmentId: string) {
    const attempts = await this.assessmentResults(assessmentId);
    const rows = attempts.map((a) => ({
      StudentName: a.student.name,
      StudentCode: a.student.studentCode,
      Section: a.student.section ?? '',
      Batch: a.student.batch ?? '',
      Status: a.status,
      AutoScore: a.autoScore ?? '',
      ManualScore: a.manualScore ?? '',
      FinalScore: a.finalScore ?? '',
      ResultStatus: a.resultStatus,
      SubmittedAt: a.submittedAt?.toISOString() ?? '',
    }));
    return stringify(rows, { header: true });
  }
}
