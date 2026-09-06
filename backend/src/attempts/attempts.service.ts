import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttemptStatus, Question, QuestionOption } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { seededShuffle } from '../common/utils/shuffle';
import { autoGrade } from './auto-evaluation.util';
import { SaveAnswerDto } from './dto/attempt.dto';

type QuestionWithRelations = Question & { options: QuestionOption[] };

@Injectable()
export class AttemptsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private realtime: RealtimeGateway,
  ) {}

  // ── Student-facing: what's on my plate ──────────────────────────────────

  async availableForStudent(studentId: string) {
    const assignments = await this.prisma.assessmentAssignment.findMany({
      where: { studentId },
      include: {
        assessment: { include: { subject: true, _count: { select: { questions: true } } } },
      },
    });

    const attempts = await this.prisma.attemptRecord.findMany({
      where: { studentId, assessmentId: { in: assignments.map((a) => a.assessmentId) } },
    });

    const now = new Date();

    return assignments.map(({ assessment }) => {
      const attemptsForThis = attempts.filter((a) => a.assessmentId === assessment.id);
      const latest = attemptsForThis.sort((a, b) => b.attemptNumber - a.attemptNumber)[0];

      let status: string;
      if (latest && ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED', 'TERMINATED'].includes(latest.status)) {
        status = 'Completed';
      } else if (now < assessment.startAt) {
        status = 'Upcoming';
      } else if (now > assessment.endAt) {
        status = attemptsForThis.length ? 'Completed' : 'Expired';
      } else if (latest && latest.status === 'IN_PROGRESS') {
        status = 'In Progress';
      } else if (assessment.status === 'ACTIVE' || assessment.status === 'SCHEDULED') {
        status = attemptsForThis.length < assessment.maxAttempts ? 'Available' : 'Completed';
      } else {
        status = 'Unavailable';
      }

      return {
        assessment: {
          id: assessment.id,
          title: assessment.title,
          type: assessment.type,
          subject: assessment.subject.name,
          totalMarks: assessment.totalMarks,
          durationMinutes: assessment.durationMinutes,
          startAt: assessment.startAt,
          endAt: assessment.endAt,
          totalQuestions: assessment._count.questions,
          maxAttempts: assessment.maxAttempts,
        },
        status,
        attemptsUsed: attemptsForThis.length,
        activeAttemptId: latest && latest.status === 'IN_PROGRESS' ? latest.id : null,
      };
    });
  }

  async instructions(assessmentId: string, studentId: string) {
    const assignment = await this.prisma.assessmentAssignment.findUnique({
      where: { assessmentId_studentId: { assessmentId, studentId } },
      include: { assessment: { include: { subject: true, _count: { select: { questions: true } } } } },
    });
    if (!assignment) throw new ForbiddenException('You are not assigned to this assessment');

    const { assessment } = assignment;
    return {
      id: assessment.id,
      title: assessment.title,
      subject: assessment.subject.name,
      description: assessment.description,
      totalQuestions: assessment._count.questions,
      totalMarks: assessment.totalMarks,
      durationMinutes: assessment.durationMinutes,
      startAt: assessment.startAt,
      endAt: assessment.endAt,
      deviceRestriction: assessment.deviceRestriction,
      requireFullscreen: assessment.requireFullscreen,
      violationLimit: assessment.violationLimit,
      violationAction: assessment.violationAction,
      maxAttempts: assessment.maxAttempts,
    };
  }

  // ── Starting / resuming an attempt ───────────────────────────────────────

  async start(studentId: string, assessmentId: string) {
    const assignment = await this.prisma.assessmentAssignment.findUnique({
      where: { assessmentId_studentId: { assessmentId, studentId } },
      include: {
        assessment: {
          include: { questions: { include: { question: true }, orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!assignment) throw new ForbiddenException('You are not assigned to this assessment');

    const { assessment } = assignment;
    const now = new Date();

    if (assessment.status !== 'ACTIVE' && assessment.status !== 'SCHEDULED') {
      throw new BadRequestException('This assessment is not currently open');
    }
    if (now < assessment.startAt) throw new BadRequestException('This assessment has not started yet');
    if (now > assessment.endAt) throw new BadRequestException('The examination window has closed');

    const existingAttempts = await this.prisma.attemptRecord.findMany({
      where: { assessmentId, studentId },
      orderBy: { attemptNumber: 'desc' },
    });

    const inProgress = existingAttempts.find((a) => a.status === 'IN_PROGRESS');
    if (inProgress) {
      if (!assessment.allowResume) throw new BadRequestException('Resuming this examination is not permitted');
      return this.getState(inProgress.id, studentId);
    }

    if (existingAttempts.length >= assessment.maxAttempts) {
      throw new BadRequestException('You have used all allowed attempts for this assessment');
    }

    if (!assessment.questions.length) throw new BadRequestException('This assessment has no questions configured');

    let questionIds = assessment.questions.map((q) => q.questionId);
    const attemptNumber = existingAttempts.length + 1;
    const seed = `${assessmentId}:${studentId}:${attemptNumber}`;

    if (assessment.randomizeQuestionOrder) {
      questionIds = seededShuffle(questionIds, seed);
    }
    if (assessment.questionsPerAttempt && assessment.questionsPerAttempt < questionIds.length) {
      questionIds = questionIds.slice(0, assessment.questionsPerAttempt);
    }

    const deadlineAt = new Date(now.getTime() + assessment.durationMinutes * 60_000);

    const attempt = await this.prisma.attemptRecord.create({
      data: {
        assessmentId,
        studentId,
        attemptNumber,
        status: 'IN_PROGRESS',
        startedAt: now,
        deadlineAt,
        questionOrder: questionIds,
        lastActivityAt: now,
        answers: { create: questionIds.map((questionId) => ({ questionId })) },
      },
    });

    const studentUser = await this.prisma.student.findUnique({ where: { id: studentId }, select: { userId: true } });
    await this.auditLogs.record({
      userId: studentUser?.userId,
      role: 'STUDENT',
      action: 'EXAM_STARTED',
      entityType: 'AttemptRecord',
      entityId: attempt.id,
      metadata: { assessmentId },
    });

    this.realtime.broadcastAttemptUpdate(assessmentId, { attemptId: attempt.id, studentId, status: 'IN_PROGRESS' });

    return this.getState(attempt.id, studentId);
  }

  // ── Serving exam state (server-authoritative) ────────────────────────────

  async getState(attemptId: string, studentId: string) {
    const attempt = await this.loadAttemptOrThrow(attemptId, studentId);

    if (attempt.status === 'IN_PROGRESS' && attempt.deadlineAt && attempt.deadlineAt <= new Date()) {
      return this.finalizeAttempt(attempt.id, 'TIME_EXPIRED');
    }

    const assessment = attempt.assessment;
    const questionsById = new Map(assessment.questions.map((aq) => [aq.questionId, aq]));
    const answersByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));

    const orderedQuestions = attempt.questionOrder.map((questionId, index) => {
      const aq = questionsById.get(questionId)!;
      const question = aq.question as QuestionWithRelations;
      const answer = answersByQuestion.get(questionId);
      const optionOrderSeed = `${attempt.id}:${questionId}`;
      const options = assessment.randomizeOptionOrder
        ? seededShuffle(question.options, optionOrderSeed)
        : question.options;

      return {
        index,
        questionId,
        type: question.type,
        title: question.title,
        description: question.description,
        difficulty: question.difficulty,
        marks: aq.marksOverride ?? question.marks,
        negativeMarks: question.negativeMarks,
        imageUrl: question.imageUrl,
        options: options.map((o) => ({ id: o.id, text: o.text })),
        characterLimit: question.characterLimit,
        wordLimit: question.wordLimit,
        starterCode: question.starterCode,
        language: question.language,
        incorrectCode: question.incorrectCode,
        constraints: question.constraints,
        sampleInput: question.sampleInput,
        sampleOutput: question.sampleOutput,
        datasetId: question.datasetId,
        allowDatasetDownload: question.allowDatasetDownload,
        answer: answer
          ? {
              selectedOptionIds: answer.selectedOptionIds,
              textAnswer: answer.textAnswer,
              codeAnswer: answer.codeAnswer,
              isMarkedForReview: answer.isMarkedForReview,
              isAnswered: answer.isAnswered,
            }
          : null,
      };
    });

    const remainingSeconds = attempt.deadlineAt
      ? Math.max(0, Math.floor((attempt.deadlineAt.getTime() - Date.now()) / 1000))
      : null;

    return {
      attemptId: attempt.id,
      assessment: {
        id: assessment.id,
        title: assessment.title,
        requireFullscreen: assessment.requireFullscreen,
        violationLimit: assessment.violationLimit,
        violationAction: assessment.violationAction,
      },
      status: attempt.status,
      currentQuestionIndex: attempt.currentQuestionIndex,
      violationCount: attempt.violationCount,
      remainingSeconds,
      deadlineAt: attempt.deadlineAt,
      questions: orderedQuestions,
      summary: {
        total: orderedQuestions.length,
        answered: orderedQuestions.filter((q) => q.answer?.isAnswered).length,
        markedForReview: orderedQuestions.filter((q) => q.answer?.isMarkedForReview).length,
        unanswered: orderedQuestions.filter((q) => !q.answer?.isAnswered).length,
      },
    };
  }

  private async loadAttemptOrThrow(attemptId: string, studentId: string) {
    const attempt = await this.prisma.attemptRecord.findUnique({
      where: { id: attemptId },
      include: {
        assessment: {
          include: { questions: { include: { question: { include: { options: true, testCases: true } } } } },
        },
        answers: true,
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.studentId !== studentId) throw new ForbiddenException('This attempt does not belong to you');
    return attempt;
  }

  // ── Autosave ──────────────────────────────────────────────────────────────

  async saveAnswer(attemptId: string, studentId: string, dto: SaveAnswerDto) {
    const attempt = await this.prisma.attemptRecord.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.studentId !== studentId) throw new ForbiddenException();
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('This examination is not in progress');
    if (attempt.deadlineAt && attempt.deadlineAt <= new Date()) {
      await this.finalizeAttempt(attemptId, 'TIME_EXPIRED');
      throw new BadRequestException('Time has expired for this examination');
    }

    const isAnswered = Boolean(
      (dto.selectedOptionIds && dto.selectedOptionIds.length) ||
        (dto.textAnswer && dto.textAnswer.trim().length) ||
        (dto.codeAnswer && dto.codeAnswer.trim().length),
    );

    await this.prisma.studentAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
      update: {
        selectedOptionIds: dto.selectedOptionIds ?? undefined,
        textAnswer: dto.textAnswer ?? undefined,
        codeAnswer: dto.codeAnswer ?? undefined,
        isMarkedForReview: dto.isMarkedForReview ?? undefined,
        isAnswered,
      },
      create: {
        attemptId,
        questionId: dto.questionId,
        selectedOptionIds: dto.selectedOptionIds ?? [],
        textAnswer: dto.textAnswer,
        codeAnswer: dto.codeAnswer,
        isMarkedForReview: dto.isMarkedForReview ?? false,
        isAnswered,
      },
    });

    await this.prisma.attemptRecord.update({
      where: { id: attemptId },
      data: { lastActivityAt: new Date() },
    });

    return { saved: true, savedAt: new Date().toISOString() };
  }

  async navigate(attemptId: string, studentId: string, questionIndex: number) {
    const attempt = await this.prisma.attemptRecord.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== studentId) throw new NotFoundException();
    await this.prisma.attemptRecord.update({
      where: { id: attemptId },
      data: { currentQuestionIndex: questionIndex, lastActivityAt: new Date() },
    });
    return { success: true };
  }

  // ── Submission & auto-grading ─────────────────────────────────────────────

  async submit(attemptId: string, studentId: string) {
    const attempt = await this.prisma.attemptRecord.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.studentId !== studentId) throw new ForbiddenException();
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('This examination is not in progress');

    return this.finalizeAttempt(attemptId, 'STUDENT_SUBMITTED');
  }

  async finalizeAttempt(
    attemptId: string,
    reason: 'TIME_EXPIRED' | 'STUDENT_SUBMITTED' | 'VIOLATION_LIMIT_REACHED' | 'ADMIN_TERMINATED' | 'ADMIN_ENDED',
    targetStatus?: AttemptStatus,
  ) {
    const attempt = await this.prisma.attemptRecord.findUnique({
      where: { id: attemptId },
      include: {
        answers: { include: { question: { include: { options: true } } } },
        student: { select: { userId: true } },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'IN_PROGRESS' && attempt.status !== 'PAUSED') return attempt;

    let autoScore = 0;
    let needsManualEvaluation = false;

    for (const answer of attempt.answers) {
      const graded = autoGrade(answer.question as any, {
        selectedOptionIds: answer.selectedOptionIds,
        textAnswer: answer.textAnswer,
      });
      if (graded) {
        autoScore += graded.score;
        await this.prisma.studentAnswer.update({
          where: { id: answer.id },
          data: { isAutoEvaluated: true, autoScore: graded.score, autoCorrect: graded.correct },
        });
      } else if (answer.isAnswered) {
        needsManualEvaluation = true;
      }
    }

    autoScore = Math.max(0, autoScore);

    const finalStatus: AttemptStatus =
      targetStatus ??
      (reason === 'TIME_EXPIRED'
        ? 'AUTO_SUBMITTED'
        : reason === 'VIOLATION_LIMIT_REACHED'
          ? 'AUTO_SUBMITTED'
          : reason === 'ADMIN_TERMINATED'
            ? 'TERMINATED'
            : 'SUBMITTED');

    const updated = await this.prisma.attemptRecord.update({
      where: { id: attemptId },
      data: {
        status: finalStatus,
        submittedAt: new Date(),
        submissionReason: reason,
        autoScore,
        finalScore: needsManualEvaluation ? null : autoScore,
        resultStatus: needsManualEvaluation ? 'PENDING_EVALUATION' : 'EVALUATED',
      },
    });

    await this.auditLogs.record({
      userId: attempt.student.userId,
      role: 'STUDENT',
      action: 'EXAM_SUBMITTED',
      entityType: 'AttemptRecord',
      entityId: attemptId,
      metadata: { reason, autoScore },
    });

    this.realtime.broadcastAttemptUpdate(attempt.assessmentId, {
      attemptId,
      studentId: attempt.studentId,
      status: finalStatus,
    });

    return { ...updated, reason };
  }

  // ── Background: enforce server-authoritative deadlines ───────────────────

  async autoSubmitExpiredAttempts() {
    const expired = await this.prisma.attemptRecord.findMany({
      where: { status: 'IN_PROGRESS', deadlineAt: { lte: new Date() } },
      select: { id: true },
    });
    for (const attempt of expired) {
      await this.finalizeAttempt(attempt.id, 'TIME_EXPIRED');
    }
    return expired.length;
  }
}
