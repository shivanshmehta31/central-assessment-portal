import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  // "Cloud Computing" -> CC, "Operating System" -> OS, "Maths" -> MATHS (suffix added if taken)
  private async uniqueSubjectCode(name: string) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const raw = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 5);
    const base = raw.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SUBJ';
    let code = base;
    let n = 1;
    while (await this.prisma.subject.findUnique({ where: { code } })) code = `${base}${++n}`;
    return code;
  }

  async createSubject(data: { name: string; code?: string; courseId: string; syllabusUnits?: unknown }) {
    const course = await this.prisma.course.findUnique({ where: { id: data.courseId } });
    if (!course) throw new BadRequestException('Selected course does not exist');

    const name = data.name.trim();
    const duplicate = await this.prisma.subject.findFirst({
      where: { courseId: data.courseId, name: { equals: name, mode: 'insensitive' } },
    });
    if (duplicate) throw new BadRequestException(`"${duplicate.name}" already exists in this course`);

    const code = data.code?.trim() ? data.code.trim().toUpperCase() : await this.uniqueSubjectCode(name);
    return this.prisma.subject.create({ data: { ...data, name, code } as any });
  }

  async updateSubject(id: string, data: { name?: string; code?: string; syllabusUnits?: unknown }) {
    await this.getSubject(id);
    return this.prisma.subject.update({
      where: { id },
      data: { ...data, name: data.name?.trim(), code: data.code?.trim().toUpperCase() } as any,
    });
  }

  async deleteSubject(id: string) {
    const subject = await this.getSubject(id);
    const [questions, assessments] = await Promise.all([
      this.prisma.question.count({ where: { subjectId: id } }),
      this.prisma.assessment.count({ where: { subjectId: id } }),
    ]);
    if (questions || assessments) {
      throw new BadRequestException(
        `"${subject.name}" has ${questions} question(s) and ${assessments} assessment(s), so it can't be deleted.`,
      );
    }
    await this.prisma.subject.delete({ where: { id } });
    return { success: true };
  }
}
