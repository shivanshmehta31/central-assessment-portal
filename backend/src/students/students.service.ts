import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { generateTempPassword } from '../common/utils/credentials';
import { CreateStudentDto, StudentQueryDto, UpdateStudentDto } from './dto/students.dto';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async list(query: StudentQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { studentCode: { contains: query.search, mode: 'insensitive' } },
        { enrollmentNumber: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.semester) where.semester = Number(query.semester);
    if (query.section) where.section = query.section;
    if (query.batch) where.batch = query.batch;
    if (query.status) where.user = { ...(where.user ?? {}), status: query.status };

    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        include: { user: { select: { email: true, status: true, lastLoginAt: true } }, department: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.student.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async get(id: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: { user: true, department: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async assessmentHistory(id: string) {
    return this.prisma.attemptRecord.findMany({
      where: { studentId: id },
      include: { assessment: { select: { title: true, type: true, totalMarks: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateStudentDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new BadRequestException('A user with this email already exists');

    const password = dto.password ?? generateTempPassword();
    const passwordHash = await AuthService.hashPassword(password);

    const student = await this.prisma.student.create({
      data: {
        studentCode: dto.studentCode,
        enrollmentNumber: dto.enrollmentNumber,
        name: dto.name,
        phone: dto.phone,
        departmentId: dto.departmentId,
        branch: dto.branch,
        semester: dto.semester,
        section: dto.section,
        batch: dto.batch,
        academicYear: dto.academicYear,
        user: {
          create: {
            email: dto.email.toLowerCase(),
            passwordHash,
            role: 'STUDENT' as const,
            mustResetPassword: true,
          },
        },
      } as any,
      include: { user: true },
    });

    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: 'STUDENT_CREATED',
      entityType: 'Student',
      entityId: student.id,
    });

    return { student, temporaryPassword: password };
  }

  async bulkImport(rows: Record<string, any>[], actorId: string) {
    const results: { row: number; success: boolean; error?: string; studentCode?: string; temporaryPassword?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const dto: CreateStudentDto = {
          name: String(row.name ?? row.Name ?? '').trim(),
          email: String(row.email ?? row.Email ?? '').trim().toLowerCase(),
          studentCode: String(row.studentCode ?? row.student_id ?? row['Student ID'] ?? '').trim(),
          enrollmentNumber: String(row.enrollmentNumber ?? row.enrollment_number ?? row['Enrollment Number'] ?? '').trim(),
          phone: row.phone ? String(row.phone) : undefined,
          departmentId: String(row.departmentId ?? row.department_id ?? '').trim(),
          branch: row.branch ? String(row.branch) : undefined,
          semester: row.semester ? Number(row.semester) : undefined,
          section: row.section ? String(row.section) : undefined,
          batch: row.batch ? String(row.batch) : undefined,
          academicYear: row.academicYear ? String(row.academicYear) : undefined,
        };

        if (!dto.name || !dto.email || !dto.studentCode || !dto.enrollmentNumber || !dto.departmentId) {
          throw new Error('Missing required field(s): name, email, studentCode, enrollmentNumber, departmentId');
        }

        const { student, temporaryPassword } = await this.create(dto, actorId);
        results.push({ row: i + 1, success: true, studentCode: student.studentCode, temporaryPassword });
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

  parseCsvBuffer(buffer: Buffer) {
    return parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, any>[];
  }

  async parseExcelBuffer(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const headerRow = sheet.getRow(1).values as any[];
    const headers = headerRow.slice(1).map((h) => String(h ?? '').trim());
    const rows: Record<string, any>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = (row.values as any[]).slice(1);
      const record: Record<string, any> = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx];
      });
      rows.push(record);
    });
    return rows;
  }

  async update(id: string, dto: UpdateStudentDto, actorId: string) {
    const student = await this.get(id);
    if (dto.email && dto.email.toLowerCase() !== student.user.email) {
      const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
      if (exists) throw new BadRequestException('Email already in use');
    }

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        departmentId: dto.departmentId,
        branch: dto.branch,
        semester: dto.semester,
        section: dto.section,
        batch: dto.batch,
        academicYear: dto.academicYear,
        user: dto.email ? { update: { email: dto.email.toLowerCase() } } : undefined,
      } as any,
      include: { user: true },
    });

    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: 'STUDENT_UPDATED',
      entityType: 'Student',
      entityId: id,
    });

    return updated;
  }

  async delete(id: string, actorId: string) {
    const student = await this.get(id);
    await this.prisma.user.delete({ where: { id: student.userId } });
    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: 'STUDENT_DELETED',
      entityType: 'Student',
      entityId: id,
    });
    return { success: true };
  }

  async setStatus(id: string, active: boolean, actorId: string) {
    const student = await this.get(id);
    await this.prisma.user.update({
      where: { id: student.userId },
      data: { status: active ? 'ACTIVE' : 'INACTIVE' },
    });
    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: active ? 'STUDENT_ACTIVATED' : 'STUDENT_DEACTIVATED',
      entityType: 'Student',
      entityId: id,
    });
    return { success: true };
  }

  async bulkSetStatus(studentIds: string[], active: boolean, actorId: string) {
    const students = await this.prisma.student.findMany({ where: { id: { in: studentIds } } });
    await this.prisma.user.updateMany({
      where: { id: { in: students.map((s) => s.userId) } },
      data: { status: active ? 'ACTIVE' : 'INACTIVE' },
    });
    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: active ? 'STUDENT_BULK_ACTIVATED' : 'STUDENT_BULK_DEACTIVATED',
      entityType: 'Student',
      metadata: { count: studentIds.length },
    });
    return { success: true, count: studentIds.length };
  }

  async resetPassword(id: string, actorId: string) {
    const student = await this.get(id);
    const password = generateTempPassword();
    const passwordHash = await AuthService.hashPassword(password);
    await this.prisma.user.update({
      where: { id: student.userId },
      data: { passwordHash, mustResetPassword: true },
    });
    await this.prisma.refreshToken.updateMany({ where: { userId: student.userId }, data: { revoked: true } });
    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: 'STUDENT_PASSWORD_RESET',
      entityType: 'Student',
      entityId: id,
    });
    return { temporaryPassword: password };
  }
}
