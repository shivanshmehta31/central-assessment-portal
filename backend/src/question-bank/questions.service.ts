import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateQuestionDto, QuestionQueryDto, UpdateQuestionDto } from './dto/question.dto';

@Injectable()
export class QuestionsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async list(query: QuestionQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: any = { isActive: true };
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.type) where.type = query.type;
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.topic) where.topic = query.topic;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { tags: { has: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: { options: true, testCases: true, subject: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.question.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async get(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { options: true, testCases: true, subject: true, dataset: true },
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  async create(dto: CreateQuestionDto, facultyId: string | undefined, actorId: string) {
    const question = await this.prisma.question.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type as any,
        difficulty: (dto.difficulty as any) ?? 'MEDIUM',
        subjectId: dto.subjectId,
        topic: dto.topic,
        subtopic: dto.subtopic,
        marks: dto.marks ?? 1,
        negativeMarks: dto.negativeMarks ?? 0,
        tags: dto.tags ?? [],
        explanation: dto.explanation,
        imageUrl: dto.imageUrl,
        shortAnswerKey: dto.shortAnswerKey,
        characterLimit: dto.characterLimit,
        wordLimit: dto.wordLimit,
        starterCode: dto.starterCode,
        language: dto.language ?? 'python',
        incorrectCode: dto.incorrectCode,
        expectedOutput: dto.expectedOutput,
        constraints: dto.constraints,
        sampleInput: dto.sampleInput,
        sampleOutput: dto.sampleOutput,
        datasetId: dto.datasetId,
        allowedLibraries: dto.allowedLibraries ?? [],
        allowDatasetDownload: dto.allowDatasetDownload ?? false,
        createdById: facultyId,
        options: dto.options
          ? { create: dto.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order ?? i })) }
          : undefined,
        testCases: dto.testCases
          ? {
              create: dto.testCases.map((t) => ({
                input: t.input,
                expectedOutput: t.expectedOutput,
                isHidden: t.isHidden ?? false,
                weight: t.weight ?? 1,
              })),
            }
          : undefined,
      },
      include: { options: true, testCases: true },
    });

    await this.auditLogs.record({ userId: actorId, action: 'QUESTION_CREATED', entityType: 'Question', entityId: question.id });
    return question;
  }

  async update(id: string, dto: UpdateQuestionDto, actorId: string) {
    await this.get(id);

    await this.prisma.$transaction([
      this.prisma.questionOption.deleteMany({ where: { questionId: id } }),
      this.prisma.testCase.deleteMany({ where: { questionId: id } }),
    ]);

    const question = await this.prisma.question.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type as any,
        difficulty: dto.difficulty as any,
        subjectId: dto.subjectId,
        topic: dto.topic,
        subtopic: dto.subtopic,
        marks: dto.marks,
        negativeMarks: dto.negativeMarks,
        tags: dto.tags,
        explanation: dto.explanation,
        imageUrl: dto.imageUrl,
        shortAnswerKey: dto.shortAnswerKey,
        characterLimit: dto.characterLimit,
        wordLimit: dto.wordLimit,
        starterCode: dto.starterCode,
        language: dto.language,
        incorrectCode: dto.incorrectCode,
        expectedOutput: dto.expectedOutput,
        constraints: dto.constraints,
        sampleInput: dto.sampleInput,
        sampleOutput: dto.sampleOutput,
        datasetId: dto.datasetId,
        allowedLibraries: dto.allowedLibraries,
        allowDatasetDownload: dto.allowDatasetDownload,
        options: dto.options
          ? { create: dto.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order ?? i })) }
          : undefined,
        testCases: dto.testCases
          ? {
              create: dto.testCases.map((t) => ({
                input: t.input,
                expectedOutput: t.expectedOutput,
                isHidden: t.isHidden ?? false,
                weight: t.weight ?? 1,
              })),
            }
          : undefined,
      },
      include: { options: true, testCases: true },
    });

    await this.auditLogs.record({ userId: actorId, action: 'QUESTION_UPDATED', entityType: 'Question', entityId: id });
    return question;
  }

  async delete(id: string, actorId: string) {
    await this.get(id);
    await this.prisma.question.update({ where: { id }, data: { isActive: false } });
    await this.auditLogs.record({ userId: actorId, action: 'QUESTION_ARCHIVED', entityType: 'Question', entityId: id });
    return { success: true };
  }

  async importCsvRows(rows: Record<string, any>[], subjectId: string, actorId: string) {
    const results: { row: number; success: boolean; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const type = String(row.questionType ?? row['Question type'] ?? 'MCQ').toUpperCase().replace(/\s+/g, '_');
        const optionTexts = [row.optionA, row.optionB, row.optionC, row.optionD].filter((v) => v != null && v !== '');
        const correctAnswer = String(row.correctAnswer ?? row['Correct answer'] ?? '').trim().toUpperCase();
        const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctAnswer);

        await this.create(
          {
            title: String(row.question ?? row.Question ?? '').slice(0, 120),
            description: String(row.question ?? row.Question ?? ''),
            type: type as any,
            difficulty: String(row.difficulty ?? row.Difficulty ?? 'MEDIUM').toUpperCase(),
            subjectId,
            topic: String(row.topic ?? row.Topic ?? 'General'),
            marks: row.marks ? Number(row.marks) : 1,
            options: optionTexts.length
              ? optionTexts.map((text, idx) => ({ text: String(text), isCorrect: idx === correctIndex }))
              : undefined,
          } as any,
          undefined,
          actorId,
        );
        results.push({ row: i + 1, success: true });
      } catch (err: any) {
        results.push({ row: i + 1, success: false, error: err.message ?? 'Import failed' });
      }
    }

    return {
      total: rows.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  async topics(subjectId: string) {
    const questions = await this.prisma.question.findMany({
      where: { subjectId, isActive: true },
      select: { topic: true },
      distinct: ['topic'],
    });
    return questions.map((q) => q.topic);
  }
}
