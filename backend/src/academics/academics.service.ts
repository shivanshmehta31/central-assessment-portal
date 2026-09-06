import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AcademicsService {
  constructor(private prisma: PrismaService) {}

  // Departments
  listDepartments() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  createDepartment(data: { name: string; code: string }) {
    return this.prisma.department.create({ data });
  }

  async updateDepartment(id: string, data: Partial<{ name: string; code: string }>) {
    await this.ensureDepartment(id);
    return this.prisma.department.update({ where: { id }, data });
  }

  async deleteDepartment(id: string) {
    await this.ensureDepartment(id);
    await this.prisma.department.delete({ where: { id } });
    return { success: true };
  }

  private async ensureDepartment(id: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  // Courses
  listCourses(departmentId?: string) {
    return this.prisma.course.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: { department: true },
      orderBy: { name: 'asc' },
    });
  }

  createCourse(data: { name: string; code: string; departmentId: string }) {
    return this.prisma.course.create({ data });
  }

  async updateCourse(id: string, data: Partial<{ name: string; code: string; departmentId: string }>) {
    return this.prisma.course.update({ where: { id }, data });
  }

  async deleteCourse(id: string) {
    await this.prisma.course.delete({ where: { id } });
    return { success: true };
  }

  // Subjects
  listSubjects(courseId?: string) {
    return this.prisma.subject.findMany({
      where: courseId ? { courseId } : undefined,
      include: { course: { include: { department: true } } },
      orderBy: { name: 'asc' },
    });
  }

  getSubject(id: string) {
    return this.prisma.subject.findUniqueOrThrow({
      where: { id },
      include: { course: { include: { department: true } } },
    });
  }

  createSubject(data: { name: string; code: string; courseId: string; syllabusUnits?: unknown }) {
    return this.prisma.subject.create({ data: data as any });
  }

  async updateSubject(id: string, data: Partial<{ name: string; code: string; syllabusUnits: unknown }>) {
    return this.prisma.subject.update({ where: { id }, data: data as any });
  }

  async deleteSubject(id: string) {
    await this.prisma.subject.delete({ where: { id } });
    return { success: true };
  }
}
