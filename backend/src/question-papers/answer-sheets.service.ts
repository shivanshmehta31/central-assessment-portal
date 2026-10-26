import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { QuestionPapersService } from './question-papers.service';
import { SaveSheetScoresDto } from './dto/question-paper.dto';

const SHEET_KINDS = ['pdf', 'png', 'jpg'] as const;

export interface BulkSheetResult {
  filename: string;
  status: 'uploaded' | 'replaced' | 'error';
  studentName?: string;
  studentCode?: string;
  error?: string;
}

@Injectable()
export class AnswerSheetsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private notifications: NotificationsService,
    private files: FilesService,
    private papers: QuestionPapersService,
  ) {}

  private async orderedQuestionIds(paperId: string) {
    const links = await this.prisma.assessmentQuestion.findMany({
      where: { assessmentId: paperId },
      orderBy: { order: 'asc' },
      select: { questionId: true },
    });
    return links.map((l) => l.questionId);
  }

  // Creates the sheet for a student, or swaps the file if one was already uploaded.
  private async attachSheet(user: AuthUser, paperId: string, studentId: string, file: Express.Multer.File | undefined) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const existing = await this.prisma.attemptRecord.findFirst({ where: { assessmentId: paperId, studentId } });
    if (existing?.resultStatus === 'PUBLISHED') {
      throw new BadRequestException('Results for this student are already published; the sheet can no longer be replaced');
    }

    const stored = await this.files.save(file, [...SHEET_KINDS], user.userId);

    if (existing) {
      await this.prisma.attemptRecord.update({ where: { id: existing.id }, data: { answerSheetFileId: stored.id } });
      await this.files.remove(existing.answerSheetFileId);
    } else {
      const questionIds = await this.orderedQuestionIds(paperId);
      await this.prisma.attemptRecord.create({
        data: {
          assessmentId: paperId,
          studentId,
          attemptNumber: 1,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          resultStatus: 'PENDING_EVALUATION',
          questionOrder: questionIds,
          answerSheetFileId: stored.id,
          answers: { create: questionIds.map((questionId) => ({ questionId })) },
        },
      });
    }

    await this.auditLogs.record({
      userId: user.userId,
      role: user.role,
      action: existing ? 'ANSWER_SHEET_REPLACED' : 'ANSWER_SHEET_UPLOADED',
      entityType: 'Assessment',
      entityId: paperId,
      metadata: { studentId, filename: stored.filename },
    });
    return { student, replaced: !!existing };
  }

  async upload(user: AuthUser, paperId: string, studentId: string | undefined, file: Express.Multer.File | undefined) {
    await this.papers.assertAccess(user, paperId);
    if (!studentId) throw new BadRequestException('Select a student for this answer sheet');
    const { student, replaced } = await this.attachSheet(user, paperId, studentId, file);
    return { studentName: student.name, studentCode: student.studentCode, replaced };
  }

  // Files are matched to students by name: "CSE2026001.pdf" or "CSE2026001_Aarav.pdf".
  async bulkUpload(user: AuthUser, paperId: string, files: Express.Multer.File[] | undefined) {
    await this.papers.assertAccess(user, paperId);
    if (!files?.length) throw new BadRequestException('No files uploaded');

    const results: BulkSheetResult[] = [];
    for (const file of files) {
      const stem = file.originalname.replace(/\.[^.]+$/, '').trim();
      const candidates = [...new Set([stem, ...stem.split(/[_\s]+/)])].filter(Boolean);
      const student = await this.prisma.student.findFirst({
        where: {
          OR: candidates.flatMap((c) => [
            { studentCode: { equals: c, mode: 'insensitive' as const } },
            { enrollmentNumber: { equals: c, mode: 'insensitive' as const } },
          ]),
        },
      });
      if (!student) {
        results.push({ filename: file.originalname, status: 'error', error: 'No student matches this file name (name the file after the Student ID)' });
        continue;
      }
      try {
        const { replaced } = await this.attachSheet(user, paperId, student.id, file);
        results.push({ filename: file.originalname, status: replaced ? 'replaced' : 'uploaded', studentName: student.name, studentCode: student.studentCode });
      } catch (err: any) {
        results.push({ filename: file.originalname, status: 'error', studentName: student.name, studentCode: student.studentCode, error: err.message ?? 'Upload failed' });
      }
    }
    return {
      total: results.length,
      succeeded: results.filter((r) => r.status !== 'error').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    };
  }

  async list(user: AuthUser, paperId: string) {
    const paper = await this.papers.assertAccess(user, paperId);
    const attempts = await this.prisma.attemptRecord.findMany({
      where: { assessmentId: paperId },
      include: {
        student: { select: { id: true, name: true, studentCode: true, section: true } },
        answerSheetFile: { select: { id: true, filename: true, mimeType: true, size: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      totalMarks: paper.totalMarks,
      passingMarks: paper.passingMarks,
      items: attempts.map((a) => ({
        attemptId: a.id,
        student: a.student,
        file: a.answerSheetFile,
        resultStatus: a.resultStatus,
        finalScore: a.finalScore,
        manualScore: a.manualScore,
        uploadedAt: a.createdAt,
      })),
    };
  }

  private async loadAttempt(paperId: string, attemptId: string) {
    const attempt = await this.prisma.attemptRecord.findUnique({
      where: { id: attemptId },
      include: { student: { select: { id: true, name: true, studentCode: true } } },
    });
    if (!attempt || attempt.assessmentId !== paperId) throw new NotFoundException('Answer sheet not found');
    return attempt;
  }

  private async nextPending(paperId: string, excludeAttemptId: string) {
    const next = await this.prisma.attemptRecord.findFirst({
      where: { assessmentId: paperId, resultStatus: 'PENDING_EVALUATION', id: { not: excludeAttemptId } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return next?.id ?? null;
  }

  async detail(user: AuthUser, paperId: string, attemptId: string) {
    const paper = await this.papers.assertAccess(user, paperId);
    const attempt = await this.loadAttempt(paperId, attemptId);

    const links = await this.prisma.assessmentQuestion.findMany({
      where: { assessmentId: paperId },
      orderBy: { order: 'asc' },
      include: { question: { include: { options: { orderBy: { order: 'asc' } } } } },
    });
    // Questions added after the sheet was uploaded still need a row to score against.
    await this.prisma.studentAnswer.createMany({
      data: links.map((l) => ({ attemptId, questionId: l.questionId })),
      skipDuplicates: true,
    });
    const answers = await this.prisma.studentAnswer.findMany({ where: { attemptId } });
    const byQuestion = new Map(answers.map((a) => [a.questionId, a]));

    const file = attempt.answerSheetFileId ? await this.files.meta(attempt.answerSheetFileId) : null;

    return {
      attemptId,
      student: attempt.student,
      file,
      resultStatus: attempt.resultStatus,
      finalScore: attempt.finalScore,
      totalMarks: paper.totalMarks,
      passingMarks: paper.passingMarks,
      nextPendingAttemptId: await this.nextPending(paperId, attemptId),
      questions: links.map((l, i) => {
        const q = l.question;
        const a = byQuestion.get(q.id);
        return {
          questionId: q.id,
          number: i + 1,
          title: q.title,
          description: q.description,
          type: q.type,
          topic: q.topic,
          marks: l.marksOverride ?? q.marks,
          options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          shortAnswerKey: q.shortAnswerKey,
          expectedOutput: q.expectedOutput,
          explanation: q.explanation,
          score: a?.manualScore ?? null,
          feedback: a?.facultyFeedback ?? null,
        };
      }),
    };
  }

  async saveScores(user: AuthUser, paperId: string, attemptId: string, dto: SaveSheetScoresDto) {
    await this.papers.assertAccess(user, paperId);
    const attempt = await this.loadAttempt(paperId, attemptId);
    if (attempt.resultStatus === 'PUBLISHED') {
      throw new BadRequestException('Results are already published. Use the admin score override to change a published result.');
    }

    const links = await this.prisma.assessmentQuestion.findMany({
      where: { assessmentId: paperId },
      orderBy: { order: 'asc' },
      include: { question: { select: { marks: true, title: true } } },
    });
    const maxByQuestion = new Map(links.map((l) => [l.questionId, l.marksOverride ?? l.question.marks]));

    for (const s of dto.scores) {
      const max = maxByQuestion.get(s.questionId);
      if (max == null) throw new BadRequestException('A score was submitted for a question that is not in this paper');
      if (s.score > max) {
        throw new BadRequestException(`Score for "${links.find((l) => l.questionId === s.questionId)?.question.title}" cannot exceed ${max}`);
      }
    }

    const evaluatedById = user.role === 'FACULTY' ? user.profileId : null;
    await this.prisma.$transaction(
      dto.scores.map((s) =>
        this.prisma.studentAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: s.questionId } },
          update: { manualScore: s.score, facultyFeedback: s.feedback || null, isAnswered: true, evaluatedById, evaluatedAt: new Date() },
          create: { attemptId, questionId: s.questionId, manualScore: s.score, facultyFeedback: s.feedback || null, isAnswered: true, evaluatedById, evaluatedAt: new Date() },
        }),
      ),
    );

    const answers = await this.prisma.studentAnswer.findMany({ where: { attemptId } });
    const scoredIds = new Set(answers.filter((a) => a.manualScore != null).map((a) => a.questionId));
    const total = answers.reduce((sum, a) => sum + (a.manualScore ?? 0), 0);

    let resultStatus = attempt.resultStatus;
    if (dto.finalize) {
      const missing = links.map((l, i) => ({ l, n: i + 1 })).filter(({ l }) => !scoredIds.has(l.questionId)).map(({ n }) => `Q${n}`);
      if (missing.length) throw new BadRequestException(`Score every question before finalizing (missing: ${missing.join(', ')})`);
    }

    const finalizing = !!dto.finalize && resultStatus === 'PENDING_EVALUATION';
    if (finalizing) resultStatus = 'EVALUATED';
    const alreadyFinal = attempt.resultStatus !== 'PENDING_EVALUATION';

    await this.prisma.attemptRecord.update({
      where: { id: attemptId },
      data: {
        manualScore: total,
        autoScore: 0,
        ...(finalizing || alreadyFinal ? { finalScore: total } : {}),
        resultStatus,
      },
    });

    if (finalizing) {
      await this.notifications.notify(
        attempt.studentId,
        'STUDENT',
        'RESULT_PUBLISHED',
        'Evaluation complete',
        'Your answer sheet has been evaluated. Results will be visible once published by the administrator.',
        { assessmentId: paperId },
      );
    }
    await this.auditLogs.record({
      userId: user.userId,
      role: user.role,
      action: finalizing ? 'ANSWER_SHEET_FINALIZED' : 'ANSWER_SHEET_SCORED',
      entityType: 'AttemptRecord',
      entityId: attemptId,
      metadata: { total },
    });

    return { totalScore: total, resultStatus, nextPendingAttemptId: await this.nextPending(paperId, attemptId) };
  }

  async remove(user: AuthUser, paperId: string, attemptId: string) {
    await this.papers.assertAccess(user, paperId);
    const attempt = await this.loadAttempt(paperId, attemptId);
    if (attempt.resultStatus === 'PUBLISHED') throw new BadRequestException('Published results cannot be deleted');

    await this.prisma.attemptRecord.delete({ where: { id: attemptId } });
    await this.files.remove(attempt.answerSheetFileId);
    await this.auditLogs.record({
      userId: user.userId,
      role: user.role,
      action: 'ANSWER_SHEET_DELETED',
      entityType: 'AttemptRecord',
      entityId: attemptId,
    });
    return { success: true };
  }
}
