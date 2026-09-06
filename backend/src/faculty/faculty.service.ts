import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { generateTempPassword } from '../common/utils/credentials';
import { CreateFacultyDto, UpdateFacultyDto } from './dto/faculty.dto';

@Injectable()
export class FacultyService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  list(search?: string) {
    return this.prisma.faculty.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { facultyCode: { contains: search, mode: 'insensitive' } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      include: {
        user: { select: { email: true, status: true } },
        department: true,
        facultySubjects: { include: { subject: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id },
      include: {
        user: true,
        department: true,
        facultySubjects: { include: { subject: true } },
        assignedAssessments: { include: { assessment: true } },
      },
    });
    if (!faculty) throw new NotFoundException('Faculty not found');
    return faculty;
  }

  async create(dto: CreateFacultyDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new BadRequestException('A user with this email already exists');

    const password = generateTempPassword();
    const passwordHash = await AuthService.hashPassword(password);

    const faculty = await this.prisma.faculty.create({
      data: {
        name: dto.name,
        facultyCode: dto.facultyCode,
        phone: dto.phone,
        departmentId: dto.departmentId,
        designation: dto.designation,
        user: {
          create: { email: dto.email.toLowerCase(), passwordHash, role: 'FACULTY' as const, mustResetPassword: true },
        },
        facultySubjects: dto.subjectIds
          ? { create: dto.subjectIds.map((subjectId) => ({ subjectId })) }
          : undefined,
      } as any,
      include: { user: true },
    });

    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: 'FACULTY_CREATED',
      entityType: 'Faculty',
      entityId: faculty.id,
    });

    return { faculty, temporaryPassword: password };
  }

  async update(id: string, dto: UpdateFacultyDto, actorId: string) {
    const faculty = await this.get(id);
    const updated = await this.prisma.faculty.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        departmentId: dto.departmentId,
        designation: dto.designation,
        user: dto.email ? { update: { email: dto.email.toLowerCase() } } : undefined,
      } as any,
    });
    await this.auditLogs.record({ userId: actorId, role: 'ADMIN', action: 'FACULTY_UPDATED', entityType: 'Faculty', entityId: id });
    return updated;
  }

  async assignSubjects(id: string, subjectIds: string[], actorId: string) {
    await this.get(id);
    await this.prisma.facultySubject.deleteMany({ where: { facultyId: id } });
    await this.prisma.facultySubject.createMany({
      data: subjectIds.map((subjectId) => ({ facultyId: id, subjectId })),
      skipDuplicates: true,
    });
    await this.auditLogs.record({ userId: actorId, role: 'ADMIN', action: 'FACULTY_SUBJECTS_ASSIGNED', entityType: 'Faculty', entityId: id });
    return { success: true };
  }

  async delete(id: string, actorId: string) {
    const faculty = await this.get(id);
    await this.prisma.user.delete({ where: { id: faculty.userId } });
    await this.auditLogs.record({ userId: actorId, role: 'ADMIN', action: 'FACULTY_DELETED', entityType: 'Faculty', entityId: id });
    return { success: true };
  }

  async setStatus(id: string, active: boolean, actorId: string) {
    const faculty = await this.get(id);
    await this.prisma.user.update({ where: { id: faculty.userId }, data: { status: active ? 'ACTIVE' : 'INACTIVE' } });
    await this.auditLogs.record({
      userId: actorId,
      role: 'ADMIN',
      action: active ? 'FACULTY_ACTIVATED' : 'FACULTY_DEACTIVATED',
      entityType: 'Faculty',
      entityId: id,
    });
    return { success: true };
  }

  async resetPassword(id: string, actorId: string) {
    const faculty = await this.get(id);
    const password = generateTempPassword();
    const passwordHash = await AuthService.hashPassword(password);
    await this.prisma.user.update({ where: { id: faculty.userId }, data: { passwordHash, mustResetPassword: true } });
    await this.auditLogs.record({ userId: actorId, role: 'ADMIN', action: 'FACULTY_PASSWORD_RESET', entityType: 'Faculty', entityId: id });
    return { temporaryPassword: password };
  }
}
