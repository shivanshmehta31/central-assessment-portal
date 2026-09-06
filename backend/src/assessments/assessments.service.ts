import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AssignEvaluatorsDto,
  AssignStudentsDto,
  CreateAssessmentDto,
  ExtendTimeDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto';

@Injectable()
export class AssessmentsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private realtime: RealtimeGateway,
    private notifications: NotificationsService,
  ) {}

  list(params: { status?: string; subjectId?: string; facultyId?: string }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.subjectId) where.subjectId = params.subjectId;
    if (params.facultyId) where.evaluators = { some: { facultyId: params.facultyId } };

    return this.prisma.assessment.findMany({
      where,
      include: {
        subject: { include: { course: { include: { department: true } } } },
        _count: { select: { questions: true, assignments: true, attempts: true } },
      },
      orderBy: { startAt: 'desc' },
    });
  }

  async get(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        subject: true,
        questions: { include: { question: { include: { options: true, testCases: true } } }, orderBy: { order: 'asc' } },
        assignments: { include: { student: true } },
        evaluators: { include: { faculty: true } },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async create(dto: CreateAssessmentDto, actorId: string) {
    if (new Date(dto.endAt) <= new Date(dto.startAt)) {
      throw new BadRequestException('End time must be after start time');
    }
    const assessment = await this.prisma.assessment.create({
      data: {
        title: dto.title,
        description: dto.description,
        subjectId: dto.subjectId,
        type: dto.type as any,
        totalMarks: dto.totalMarks,
        passingMarks: dto.passingMarks,
        durationMinutes: dto.durationMinutes,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        maxAttempts: dto.maxAttempts ?? 1,
        allowResume: dto.allowResume ?? true,
        randomizeQuestionOrder: dto.randomizeQuestionOrder ?? false,
        randomizeOptionOrder: dto.randomizeOptionOrder ?? false,
        questionsPerAttempt: dto.questionsPerAttempt,
        deviceRestriction: (dto.deviceRestriction as any) ?? 'DESKTOP_AND_TABLET',
        requireFullscreen: dto.requireFullscreen ?? true,
        violationLimit: dto.violationLimit ?? 3,
        violationAction: (dto.violationAction as any) ?? 'AUTO_SUBMIT',
        showResultsImmediately: dto.showResultsImmediately ?? false,
        showCorrectAnswers: dto.showCorrectAnswers ?? false,
        semester: dto.semester,
        batch: dto.batch,
        createdById: actorId,
      },
    });

    await this.auditLogs.record({ userId: actorId, action: 'ASSESSMENT_CREATED', entityType: 'Assessment', entityId: assessment.id });
    return assessment;
  }

  async update(id: string, dto: Partial<UpdateAssessmentDto>, actorId: string) {
    const existing = await this.get(id);
    if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
      throw new BadRequestException('Only draft or scheduled assessments can be edited');
    }
    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: {
        ...dto,
        type: dto.type as any,
        deviceRestriction: dto.deviceRestriction as any,
        violationAction: dto.violationAction as any,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      } as any,
    });
    await this.auditLogs.record({ userId: actorId, action: 'ASSESSMENT_UPDATED', entityType: 'Assessment', entityId: id });
    return assessment;
  }

  async attachQuestions(id: string, questionIds: string[], actorId: string) {
    await this.get(id);
    await this.prisma.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
    await this.prisma.assessmentQuestion.createMany({
      data: questionIds.map((questionId, order) => ({ assessmentId: id, questionId, order })),
    });
    await this.auditLogs.record({ userId: actorId, action: 'ASSESSMENT_QUESTIONS_UPDATED', entityType: 'Assessment', entityId: id, metadata: { count: questionIds.length } });
    return this.get(id);
  }

  async assignStudents(id: string, dto: AssignStudentsDto, actorId: string) {
    await this.get(id);
    let studentIds = dto.studentIds ?? [];

    if (!studentIds.length && (dto.departmentId || dto.semester || dto.section || dto.batch)) {
      const where: any = {};
      if (dto.departmentId) where.departmentId = dto.departmentId;
      if (dto.semester) where.semester = Number(dto.semester);
      if (dto.section) where.section = dto.section;
      if (dto.batch) where.batch = dto.batch;
      const students = await this.prisma.student.findMany({ where, select: { id: true } });
      studentIds = students.map((s) => s.id);
    }

    if (!studentIds.length) throw new BadRequestException('No students matched the assignment criteria');

    await this.prisma.assessmentAssignment.createMany({
      data: studentIds.map((studentId) => ({ assessmentId: id, studentId })),
      skipDuplicates: true,
    });

    await this.notifications.notifyMany(
      studentIds,
      'STUDENT',
      'ASSESSMENT_AVAILABLE',
      'New assessment assigned',
      `You have been assigned a new assessment.`,
      { assessmentId: id },
    );

    await this.auditLogs.record({ userId: actorId, action: 'ASSESSMENT_STUDENTS_ASSIGNED', entityType: 'Assessment', entityId: id, metadata: { count: studentIds.length } });
    return { success: true, assigned: studentIds.length };
  }

  async assignEvaluators(id: string, dto: AssignEvaluatorsDto, actorId: string) {
    await this.get(id);
    await this.prisma.assessmentEvaluator.deleteMany({ where: { assessmentId: id } });
    await this.prisma.assessmentEvaluator.createMany({
      data: dto.facultyIds.map((facultyId) => ({ assessmentId: id, facultyId })),
      skipDuplicates: true,
    });

    await this.notifications.notifyMany(
      dto.facultyIds,
      'FACULTY',
      'EVALUATION_ASSIGNED',
      'Evaluation assignment',
      'You have been assigned as an evaluator for an assessment.',
      { assessmentId: id },
    );

    return { success: true };
  }

  async publish(id: string, actorId: string) {
    const assessment = await this.get(id);
    if (!assessment.questions.length) throw new BadRequestException('Add at least one question before publishing');
    if (!assessment.assignments.length) throw new BadRequestException('Assign at least one student before publishing');

    const updated = await this.prisma.assessment.update({ where: { id }, data: { status: 'SCHEDULED' } });
    await this.auditLogs.record({ userId: actorId, action: 'ASSESSMENT_PUBLISHED', entityType: 'Assessment', entityId: id });
    return updated;
  }

  async setStatus(id: string, status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED', actorId: string) {
    const updated = await this.prisma.assessment.update({ where: { id }, data: { status } });
    this.realtime.broadcastAssessmentControl(id, { type: 'STATUS_CHANGED', status });
    await this.auditLogs.record({ userId: actorId, action: `ASSESSMENT_${status}`, entityType: 'Assessment', entityId: id });
    return updated;
  }

  async extendTime(id: string, dto: ExtendTimeDto, actorId: string) {
    const where: any = { assessmentId: id, status: 'IN_PROGRESS' };
    if (dto.attemptIds?.length) where.id = { in: dto.attemptIds };

    const attempts = await this.prisma.attemptRecord.findMany({ where });
    const seconds = dto.minutes * 60;

    await Promise.all(
      attempts.map((attempt) =>
        this.prisma.attemptRecord.update({
          where: { id: attempt.id },
          data: {
            extraTimeSeconds: { increment: seconds },
            deadlineAt: attempt.deadlineAt ? new Date(attempt.deadlineAt.getTime() + seconds * 1000) : undefined,
          },
        }),
      ),
    );

    attempts.forEach((attempt) => {
      this.realtime.notifyStudentTimeExtended(attempt.studentId, attempt.id, dto.minutes);
    });

    await this.auditLogs.record({
      userId: actorId,
      action: 'ASSESSMENT_TIME_EXTENDED',
      entityType: 'Assessment',
      entityId: id,
      metadata: { minutes: dto.minutes, attempts: attempts.length },
    });

    return { success: true, affectedAttempts: attempts.length };
  }

  async terminateAll(id: string, actorId: string) {
    const attempts = await this.prisma.attemptRecord.findMany({
      where: { assessmentId: id, status: { in: ['IN_PROGRESS', 'PAUSED'] } },
    });

    await this.prisma.attemptRecord.updateMany({
      where: { id: { in: attempts.map((a) => a.id) } },
      data: { status: 'TERMINATED', submissionReason: 'ADMIN_TERMINATED', submittedAt: new Date(), resultStatus: 'PENDING_EVALUATION' },
    });

    attempts.forEach((attempt) => this.realtime.forceSubmitStudent(attempt.studentId, attempt.id, 'ADMIN_TERMINATED'));

    await this.auditLogs.record({ userId: actorId, action: 'ASSESSMENT_EMERGENCY_TERMINATE', entityType: 'Assessment', entityId: id, metadata: { count: attempts.length } });
    return { success: true, terminated: attempts.length };
  }

  async liveStats(id: string) {
    const [total, started, completed, active, flagged, terminated] = await Promise.all([
      this.prisma.assessmentAssignment.count({ where: { assessmentId: id } }),
      this.prisma.attemptRecord.count({ where: { assessmentId: id, status: { not: 'NOT_STARTED' } } }),
      this.prisma.attemptRecord.count({ where: { assessmentId: id, status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'] } } }),
      this.prisma.attemptRecord.count({ where: { assessmentId: id, status: 'IN_PROGRESS' } }),
      this.prisma.attemptRecord.count({ where: { assessmentId: id, violationCount: { gt: 0 } } }),
      this.prisma.attemptRecord.count({ where: { assessmentId: id, status: 'TERMINATED' } }),
    ]);
    return { total, started, completed, active, flagged, terminated };
  }
}
