import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EvaluationService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private notifications: NotificationsService,
  ) {}

  private async assertEvaluator(assessmentId: string, facultyId: string) {
    const link = await this.prisma.assessmentEvaluator.findUnique({
      where: { assessmentId_facultyId: { assessmentId, facultyId } },
    });
    if (!link) throw new ForbiddenException('You are not an evaluator for this assessment');
  }

  private async facultyUserId(facultyId: string) {
    const faculty = await this.prisma.faculty.findUnique({ where: { id: facultyId }, select: { userId: true } });
    return faculty?.userId;
  }

  async myAssessments(facultyId: string) {
    const assessments = await this.prisma.assessment.findMany({
      where: { evaluators: { some: { facultyId } } },
      include: {
        subject: true,
        attempts: { select: { id: true, resultStatus: true, autoScore: true, finalScore: true, status: true } },
      },
      orderBy: { startAt: 'desc' },
    });

    return assessments.map((a) => {
      const submitted = a.attempts.filter((at) => at.status !== 'IN_PROGRESS' && at.status !== 'NOT_STARTED');
      const pending = submitted.filter((at) => at.resultStatus === 'PENDING_EVALUATION');
      const scores = submitted.map((at) => at.finalScore ?? at.autoScore ?? 0).filter((s) => s != null);
      return {
        id: a.id,
        title: a.title,
        subject: a.subject.name,
        totalStudents: submitted.length,
        completedEvaluations: submitted.length - pending.length,
        pendingEvaluations: pending.length,
        averageScore: scores.length ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null,
        highestScore: scores.length ? Math.max(...scores) : null,
        lowestScore: scores.length ? Math.min(...scores) : null,
      };
    });
  }

  async attemptsForAssessment(assessmentId: string, facultyId: string) {
    await this.assertEvaluator(assessmentId, facultyId);
    return this.prisma.attemptRecord.findMany({
      where: { assessmentId, status: { not: 'IN_PROGRESS' } },
      include: { student: { select: { name: true, studentCode: true } } },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getAttemptForGrading(attemptId: string, facultyId: string) {
    const attempt = await this.prisma.attemptRecord.findUnique({
      where: { id: attemptId },
      include: {
        student: { select: { name: true, studentCode: true } },
        assessment: { select: { id: true, title: true, totalMarks: true } },
        answers: {
          include: {
            question: { include: { options: true, testCases: { where: { isHidden: false } } } },
          },
        },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    await this.assertEvaluator(attempt.assessmentId, facultyId);
    return attempt;
  }

  async scoreAnswer(answerId: string, score: number, feedback: string | undefined, facultyId: string) {
    const answer = await this.prisma.studentAnswer.findUnique({
      where: { id: answerId },
      include: { attempt: true, question: true },
    });
    if (!answer) throw new NotFoundException('Answer not found');
    await this.assertEvaluator(answer.attempt.assessmentId, facultyId);

    if (score > answer.question.marks) {
      throw new BadRequestException(`Score cannot exceed the question's maximum marks (${answer.question.marks})`);
    }

    await this.prisma.studentAnswer.update({
      where: { id: answerId },
      data: { manualScore: score, facultyFeedback: feedback, evaluatedById: facultyId, evaluatedAt: new Date() },
    });

    await this.prisma.evaluationResult.create({
      data: { answerId, facultyId, scoreAwarded: score, feedback },
    });

    await this.auditLogs.record({
      userId: await this.facultyUserId(facultyId),
      role: 'FACULTY',
      action: 'ANSWER_SCORED',
      entityType: 'StudentAnswer',
      entityId: answerId,
      metadata: { score },
    });

    return { success: true };
  }

  async finalizeAttempt(attemptId: string, facultyId: string) {
    const attempt = await this.prisma.attemptRecord.findUnique({
      where: { id: attemptId },
      include: { answers: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    await this.assertEvaluator(attempt.assessmentId, facultyId);

    const unscored = attempt.answers.filter(
      (a) => a.isAnswered && !a.isAutoEvaluated && a.manualScore == null,
    );
    if (unscored.length) {
      throw new BadRequestException(`${unscored.length} answer(s) still need a manual score before finalizing`);
    }

    const autoTotal = attempt.answers.reduce((sum, a) => sum + (a.autoScore ?? 0), 0);
    const manualTotal = attempt.answers.reduce((sum, a) => sum + (a.manualScore ?? 0), 0);
    const finalScore = Math.max(0, autoTotal + manualTotal);

    const updated = await this.prisma.attemptRecord.update({
      where: { id: attemptId },
      data: { manualScore: manualTotal, finalScore, resultStatus: 'EVALUATED' },
    });

    await this.notifications.notify(
      attempt.studentId,
      'STUDENT',
      'RESULT_PUBLISHED',
      'Evaluation complete',
      'Your examination has been evaluated. Results will be visible once published by the administrator.',
      { assessmentId: attempt.assessmentId },
    );

    await this.auditLogs.record({
      userId: await this.facultyUserId(facultyId),
      role: 'FACULTY',
      action: 'ATTEMPT_EVALUATION_FINALIZED',
      entityType: 'AttemptRecord',
      entityId: attemptId,
      metadata: { finalScore },
    });

    return updated;
  }
}
