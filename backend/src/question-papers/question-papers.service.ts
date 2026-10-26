import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as ExcelJS from 'exceljs';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { FilesService } from '../files/files.service';
import { QuestionsService } from '../question-bank/questions.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateQuestionDto, UpdateQuestionDto } from '../question-bank/dto/question.dto';
import { BulkQuestionsDto, CreateQuestionPaperDto, QuestionDraftDto, UpdateQuestionPaperDto } from './dto/question-paper.dto';
import {
  hasQuestionColumn,
  normalizeHeader,
  QuestionDraft,
  rowsToDrafts,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  textToDrafts,
  validateDraft,
} from './question-import';

@Injectable()
export class QuestionPapersService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private files: FilesService,
    private questions: QuestionsService,
  ) {}

  // ── Access ──────────────────────────────────────────────────────────────

  // Loads a paper-based assessment and verifies the caller may manage it.
  async assertAccess(user: AuthUser, paperId: string) {
    const paper = await this.prisma.assessment.findUnique({
      where: { id: paperId },
      include: { evaluators: { select: { facultyId: true } } },
    });
    if (!paper || paper.mode !== 'OFFLINE') throw new NotFoundException('Question paper not found');
    if (user.role === 'FACULTY' && !paper.evaluators.some((e) => e.facultyId === user.profileId)) {
      throw new NotFoundException('Question paper not found');
    }
    return paper;
  }

  // ── Papers ──────────────────────────────────────────────────────────────

  async subjectsFor(user: AuthUser) {
    if (user.role === 'FACULTY') {
      const rows = await this.prisma.facultySubject.findMany({
        where: { facultyId: user.profileId },
        include: { subject: true },
      });
      return rows.map((r) => r.subject);
    }
    return this.prisma.subject.findMany({ orderBy: { name: 'asc' } });
  }

  async list(user: AuthUser) {
    const papers = await this.prisma.assessment.findMany({
      where: {
        mode: 'OFFLINE',
        ...(user.role === 'FACULTY' ? { evaluators: { some: { facultyId: user.profileId } } } : {}),
      },
      include: {
        subject: { select: { id: true, name: true } },
        questionPaperFile: { select: { id: true, filename: true } },
        _count: { select: { questions: true } },
        attempts: { select: { resultStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return papers.map(({ attempts, ...p }) => ({
      ...p,
      sheetCount: attempts.length,
      pendingCount: attempts.filter((a) => a.resultStatus === 'PENDING_EVALUATION').length,
      evaluatedCount: attempts.filter((a) => a.resultStatus !== 'PENDING_EVALUATION').length,
    }));
  }

  async create(user: AuthUser, dto: CreateQuestionPaperDto) {
    if (user.role === 'FACULTY') {
      const assigned = await this.prisma.facultySubject.findUnique({
        where: { facultyId_subjectId: { facultyId: user.profileId, subjectId: dto.subjectId } },
      });
      if (!assigned) throw new ForbiddenException('You are not assigned to this subject');
    }

    const duration = dto.durationMinutes ?? 180;
    const startAt = dto.examDate ? new Date(dto.examDate) : new Date();
    const paper = await this.prisma.assessment.create({
      data: {
        title: dto.title,
        description: dto.description,
        subjectId: dto.subjectId,
        type: (dto.type as any) ?? 'INTERNAL_ASSESSMENT',
        mode: 'OFFLINE',
        status: 'DRAFT',
        totalMarks: 0,
        passingMarks: dto.passingMarks ?? 0,
        durationMinutes: duration,
        startAt,
        endAt: new Date(startAt.getTime() + duration * 60_000),
        createdById: user.userId,
        evaluators: user.role === 'FACULTY' ? { create: { facultyId: user.profileId } } : undefined,
      },
    });
    await this.auditLogs.record({ userId: user.userId, role: user.role, action: 'QUESTION_PAPER_CREATED', entityType: 'Assessment', entityId: paper.id });
    return paper;
  }

  async get(user: AuthUser, id: string) {
    await this.assertAccess(user, id);
    const paper = await this.prisma.assessment.findUniqueOrThrow({
      where: { id },
      include: {
        subject: { select: { id: true, name: true } },
        questionPaperFile: { select: { id: true, filename: true, mimeType: true, size: true } },
        questions: {
          orderBy: { order: 'asc' },
          include: { question: { include: { options: { orderBy: { order: 'asc' } } } } },
        },
        _count: { select: { attempts: true } },
      },
    });
    return paper;
  }

  async update(user: AuthUser, id: string, dto: UpdateQuestionPaperDto) {
    const paper = await this.assertAccess(user, id);
    const duration = dto.durationMinutes ?? paper.durationMinutes;
    const startAt = dto.examDate ? new Date(dto.examDate) : paper.startAt;
    const updated = await this.prisma.assessment.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type as any,
        passingMarks: dto.passingMarks,
        durationMinutes: duration,
        startAt,
        endAt: new Date(startAt.getTime() + duration * 60_000),
      },
    });
    await this.auditLogs.record({ userId: user.userId, role: user.role, action: 'QUESTION_PAPER_UPDATED', entityType: 'Assessment', entityId: id });
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    const paper = await this.assertAccess(user, id);
    const sheets = await this.prisma.attemptRecord.count({ where: { assessmentId: id } });
    if (sheets > 0) throw new BadRequestException('Delete the uploaded answer sheets before deleting this paper');

    const links = await this.prisma.assessmentQuestion.findMany({ where: { assessmentId: id }, select: { questionId: true } });
    await this.prisma.assessment.delete({ where: { id } });
    await this.prisma.question.updateMany({ where: { id: { in: links.map((l) => l.questionId) } }, data: { isActive: false } });
    await this.files.remove(paper.questionPaperFileId);
    await this.auditLogs.record({ userId: user.userId, role: user.role, action: 'QUESTION_PAPER_DELETED', entityType: 'Assessment', entityId: id });
    return { success: true };
  }

  // ── Questions ───────────────────────────────────────────────────────────

  private async syncTotals(paperId: string) {
    const links = await this.prisma.assessmentQuestion.findMany({
      where: { assessmentId: paperId },
      orderBy: { order: 'asc' },
      include: { question: { select: { marks: true } } },
    });
    const total = links.reduce((sum, l) => sum + (l.marksOverride ?? l.question.marks), 0);
    await this.prisma.assessment.update({ where: { id: paperId }, data: { totalMarks: total } });

    // Sheets uploaded before a question was added still need an answer row for it.
    const attempts = await this.prisma.attemptRecord.findMany({ where: { assessmentId: paperId }, select: { id: true } });
    const questionIds = links.map((l) => l.questionId);
    for (const attempt of attempts) {
      await this.prisma.studentAnswer.createMany({
        data: questionIds.map((questionId) => ({ attemptId: attempt.id, questionId })),
        skipDuplicates: true,
      });
      await this.prisma.attemptRecord.update({ where: { id: attempt.id }, data: { questionOrder: questionIds } });
    }
  }

  private async attach(paperId: string, questionIds: string[]) {
    const last = await this.prisma.assessmentQuestion.aggregate({ where: { assessmentId: paperId }, _max: { order: true } });
    let order = (last._max.order ?? -1) + 1;
    await this.prisma.assessmentQuestion.createMany({
      data: questionIds.map((questionId) => ({ assessmentId: paperId, questionId, order: order++ })),
    });
    await this.syncTotals(paperId);
  }

  async addQuestion(user: AuthUser, paperId: string, dto: CreateQuestionDto) {
    const paper = await this.assertAccess(user, paperId);
    const facultyId = user.role === 'FACULTY' ? user.profileId : undefined;
    const question = await this.questions.create({ ...dto, subjectId: paper.subjectId }, facultyId, user.userId);
    await this.attach(paperId, [question.id]);
    return question;
  }

  private async assertInPaper(paperId: string, questionId: string) {
    const link = await this.prisma.assessmentQuestion.findUnique({
      where: { assessmentId_questionId: { assessmentId: paperId, questionId } },
    });
    if (!link) throw new NotFoundException('Question is not part of this paper');
  }

  async updateQuestion(user: AuthUser, paperId: string, questionId: string, dto: UpdateQuestionDto) {
    const paper = await this.assertAccess(user, paperId);
    await this.assertInPaper(paperId, questionId);
    const updated = await this.questions.update(questionId, { ...dto, subjectId: paper.subjectId }, user.userId);
    await this.syncTotals(paperId);
    return updated;
  }

  async removeQuestion(user: AuthUser, paperId: string, questionId: string) {
    await this.assertAccess(user, paperId);
    await this.assertInPaper(paperId, questionId);

    const scored = await this.prisma.studentAnswer.count({
      where: { questionId, attempt: { assessmentId: paperId }, manualScore: { not: null } },
    });
    if (scored > 0) throw new BadRequestException('This question has already been scored on answer sheets and cannot be removed');

    await this.prisma.studentAnswer.deleteMany({ where: { questionId, attempt: { assessmentId: paperId } } });
    await this.prisma.assessmentQuestion.delete({ where: { assessmentId_questionId: { assessmentId: paperId, questionId } } });
    await this.prisma.question.update({ where: { id: questionId }, data: { isActive: false } });
    await this.syncTotals(paperId);
    return { success: true };
  }

  // ── Upload + import ─────────────────────────────────────────────────────

  async parseUpload(user: AuthUser, paperId: string, file: Express.Multer.File | undefined) {
    const paper = await this.assertAccess(user, paperId);
    const stored = await this.files.save(file, ['pdf', 'csv', 'xlsx'], user.userId);

    let drafts: QuestionDraft[] = [];
    let warnings: string[] = [];
    try {
      if (stored.kind === 'csv') drafts = this.parseCsv(file!.buffer);
      else if (stored.kind === 'xlsx') drafts = await this.parseExcel(file!.buffer);
      else {
        let text: string | null = null;
        try {
          text = (await pdfParse(file!.buffer)).text ?? '';
        } catch {
          text = null;
        }
        if (text === null) {
          warnings = ['This PDF could not be read (it may be corrupted or password-protected). It is saved as the reference paper; add the questions manually.'];
        } else {
          ({ drafts, warnings } = textToDrafts(text));
        }
      }
    } catch (err) {
      await this.files.remove(stored.id);
      throw err;
    }

    await this.prisma.assessment.update({ where: { id: paperId }, data: { questionPaperFileId: stored.id } });
    await this.files.remove(paper.questionPaperFileId);
    await this.auditLogs.record({
      userId: user.userId,
      role: user.role,
      action: 'QUESTION_PAPER_UPLOADED',
      entityType: 'Assessment',
      entityId: paperId,
      metadata: { filename: stored.filename, detectedQuestions: drafts.length },
    });
    return { file: { id: stored.id, filename: stored.filename, mimeType: stored.mimeType, size: stored.size }, drafts, warnings };
  }

  private parseCsv(buffer: Buffer): QuestionDraft[] {
    let rows: Record<string, unknown>[];
    try {
      rows = parse(buffer, {
        columns: (headers: string[]) => headers.map(normalizeHeader),
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
      });
    } catch {
      throw new BadRequestException('Could not read this CSV file — check that it is a valid, comma-separated file');
    }
    if (rows.length && !hasQuestionColumn(Object.keys(rows[0]))) {
      throw new BadRequestException('No "question" column found. Download the template to see the expected columns.');
    }
    return rowsToDrafts(rows);
  }

  private async parseExcel(buffer: Buffer): Promise<QuestionDraft[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Could not read this Excel file — save it as .xlsx and try again');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('The Excel file has no sheets');

    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col - 1] = normalizeHeader(cell.text);
    });
    if (!hasQuestionColumn(headers)) {
      throw new BadRequestException('No "question" column found in the first row. Download the template to see the expected columns.');
    }

    const rows: Record<string, unknown>[] = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const record: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        if (h) record[h] = sheet.getRow(r).getCell(i + 1).text?.trim();
      });
      rows.push(record);
    }
    return rowsToDrafts(rows);
  }

  async bulkAdd(user: AuthUser, paperId: string, dto: BulkQuestionsDto) {
    const paper = await this.assertAccess(user, paperId);
    if (!dto.drafts.length) throw new BadRequestException('No questions to import');

    const problems: string[] = [];
    dto.drafts.forEach((d: QuestionDraftDto, i) => {
      const errors = validateDraft({
        ...d,
        negativeMarks: d.negativeMarks ?? 0,
        options: d.options ?? [],
        errors: [],
      } as QuestionDraft);
      if (errors.length) problems.push(`Question ${i + 1}: ${errors.join('; ')}`);
    });
    if (problems.length) throw new BadRequestException(problems.slice(0, 10));

    const facultyId = user.role === 'FACULTY' ? user.profileId : undefined;
    const createdIds: string[] = [];
    for (const d of dto.drafts) {
      const created = await this.questions.create(
        {
          title: d.title || d.description.slice(0, 100),
          description: d.description,
          type: d.type,
          subjectId: paper.subjectId,
          topic: d.topic || 'General',
          difficulty: d.difficulty ?? 'MEDIUM',
          marks: d.marks,
          negativeMarks: d.negativeMarks ?? 0,
          explanation: d.explanation,
          shortAnswerKey: d.shortAnswerKey,
          options: d.options?.filter((o) => o.text.trim()),
        } as CreateQuestionDto,
        facultyId,
        user.userId,
      );
      createdIds.push(created.id);
    }
    await this.attach(paperId, createdIds);
    await this.auditLogs.record({
      userId: user.userId,
      role: user.role,
      action: 'QUESTION_PAPER_QUESTIONS_IMPORTED',
      entityType: 'Assessment',
      entityId: paperId,
      metadata: { count: createdIds.length },
    });
    return { imported: createdIds.length };
  }

  // ── Helpers for the UI ──────────────────────────────────────────────────

  searchStudents(search?: string) {
    return this.prisma.student.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { studentCode: { contains: search, mode: 'insensitive' } },
              { enrollmentNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: { id: true, name: true, studentCode: true, enrollmentNumber: true, section: true, semester: true, batch: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  templateCsv() {
    return stringify([TEMPLATE_HEADERS, ...TEMPLATE_ROWS]);
  }

  async templateXlsx() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Questions');
    sheet.addRow(TEMPLATE_HEADERS).font = { bold: true };
    TEMPLATE_ROWS.forEach((r) => sheet.addRow(r));
    sheet.columns.forEach((c, i) => (c.width = i === 0 ? 60 : 16));
    const notes = workbook.addWorksheet('How to fill');
    [
      'question — the question text (required)',
      'type — MCQ, MULTIPLE_SELECT, TRUE_FALSE, SHORT_ANSWER, DESCRIPTIVE, CODING, ... (optional; inferred from the options when blank)',
      'optionA..optionF — answer choices for MCQ / MULTIPLE_SELECT',
      'correctAnswer — option letter(s) such as B or A,C; True/False for TRUE_FALSE; the expected answer for SHORT_ANSWER',
      'marks — marks for the question (default 1); negativeMarks — penalty for a wrong objective answer (default 0)',
      'topic, difficulty (EASY / MEDIUM / HARD), explanation — optional',
    ].forEach((line) => notes.addRow([line]));
    notes.getColumn(1).width = 120;
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
