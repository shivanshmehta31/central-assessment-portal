import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// Admin managing subjects and faculty: validation, auto-generated subject codes,
// friendly duplicate errors, and (re)assigning subjects to an existing faculty member.
describe('Admin: subjects & faculty (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: string;
  let departmentId: string;
  let courseId: string;
  const unique = Date.now();
  const created = { subjects: [] as string[], faculty: [] as string[], studentEmails: [] as string[] };
  const api = (p: string) => `/api/v1${p}`;
  const auth = () => ({ Authorization: `Bearer ${admin}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    admin = (await request(app.getHttpServer()).post(api('/auth/login')).send({ identifier: 'admin@institution.edu', password: 'Admin@12345' })).body.accessToken;
    const course = await prisma.course.findFirstOrThrow({ where: { code: 'BTECH-CSE' } });
    courseId = course.id;
    departmentId = course.departmentId;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { OR: [{ faculty: { id: { in: created.faculty } } }, { email: { in: created.studentEmails } }] } });
    await prisma.subject.deleteMany({ where: { id: { in: created.subjects } } });
    await app.close();
  });

  const addSubject = (name: string, extra: Record<string, unknown> = {}) =>
    request(app.getHttpServer()).post(api('/subjects')).set(auth()).send({ name, courseId, ...extra });

  it('generates a unique subject code from the name when none is given', async () => {
    const a = await addSubject(`Operating System ${unique}`).expect(201);
    created.subjects.push(a.body.id);
    expect(a.body.code).toMatch(/^OS\d*$/);

    // "Open Source <n>" would also want "OS": the code must not collide
    const b = await addSubject(`Open Source ${unique}`).expect(201);
    created.subjects.push(b.body.id);
    expect(b.body.code).not.toBe(a.body.code);
    expect(b.body.code).toMatch(/^OS\d+$/);
  });

  it('rejects a subject whose name already exists in the course (case-insensitive)', async () => {
    const res = await addSubject(`operating system ${unique}`).expect(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('requires a subject name and a course', async () => {
    const res = await request(app.getHttpServer()).post(api('/subjects')).set(auth()).send({ name: '', courseId: '' }).expect(400);
    expect(JSON.stringify(res.body.message)).toContain('Subject name is required');
    expect(JSON.stringify(res.body.message)).toContain('Course is required');
  });

  it('renames a subject', async () => {
    const res = await request(app.getHttpServer()).patch(api(`/subjects/${created.subjects[0]}`)).set(auth()).send({ name: `OS Renamed ${unique}` }).expect(200);
    expect(res.body.name).toBe(`OS Renamed ${unique}`);
  });

  it('gives a readable error — not Prisma internals — when a faculty member has no department', async () => {
    const res = await request(app.getHttpServer())
      .post(api('/faculty'))
      .set(auth())
      .send({ name: 'No Dept', email: `nodept-${unique}@institution.edu`, facultyCode: `ND-${unique}`, departmentId: '' })
      .expect(400);
    const text = JSON.stringify(res.body);
    expect(text).toContain('Department is required');
    expect(text).not.toMatch(/prisma|invocation|\/Users\//i);
  });

  it('creates faculty, then (re)assigns their subjects', async () => {
    const f = await request(app.getHttpServer())
      .post(api('/faculty'))
      .set(auth())
      .send({ name: 'Temp Faculty', email: `temp-${unique}@institution.edu`, facultyCode: `TF-${unique}`, departmentId, subjectIds: [created.subjects[0]] })
      .expect(201);
    created.faculty.push(f.body.faculty.id);
    expect(f.body.temporaryPassword).toBeTruthy();

    await request(app.getHttpServer()).post(api(`/faculty/${f.body.faculty.id}/subjects`)).set(auth()).send({ subjectIds: [created.subjects[1]] }).expect(201);

    const list = await request(app.getHttpServer()).get(api('/faculty')).set(auth()).expect(200);
    const row = list.body.find((x: any) => x.id === f.body.faculty.id);
    expect(row.facultySubjects.map((s: any) => s.subject.id)).toEqual([created.subjects[1]]);
  });

  it('reports a duplicate faculty ID as a conflict with a clear message', async () => {
    const res = await request(app.getHttpServer())
      .post(api('/faculty'))
      .set(auth())
      .send({ name: 'Dup', email: `dup-${unique}@institution.edu`, facultyCode: `TF-${unique}`, departmentId })
      .expect(409);
    expect(res.body.message).toMatch(/faculty code/i);
  });

  it('creates a student (and rejects a duplicate Student ID with a clear message)', async () => {
    const body = { name: 'Temp Student', email: `ts-${unique}@institution.edu`, studentCode: `TS${unique}`, enrollmentNumber: `TE${unique}`, departmentId, semester: 5, section: 'A', batch: '2026' };
    created.studentEmails.push(body.email);
    const ok = await request(app.getHttpServer()).post(api('/students')).set(auth()).send(body).expect(201);
    expect(ok.body.temporaryPassword).toBeTruthy();

    const dup = await request(app.getHttpServer()).post(api('/students')).set(auth()).send({ ...body, email: `ts2-${unique}@institution.edu`, enrollmentNumber: `TE2${unique}` }).expect(409);
    expect(dup.body.message).toMatch(/student code/i);

    const noDept = await request(app.getHttpServer()).post(api('/students')).set(auth()).send({ ...body, departmentId: '' }).expect(400);
    expect(JSON.stringify(noDept.body)).toContain('Department is required');
  });

  it('bulk-imports students from CSV', async () => {
    const rows = [1, 2].map((n) => `Import ${n},imp${n}-${unique}@institution.edu,IMP${n}${unique},IME${n}${unique},${departmentId},5,A,2026`);
    rows.forEach((_, i) => created.studentEmails.push(`imp${i + 1}-${unique}@institution.edu`));
    const csv = `name,email,studentCode,enrollmentNumber,departmentId,semester,section,batch\n${rows.join('\n')}\n`;
    const res = await request(app.getHttpServer()).post(api('/students/import/csv')).set(auth()).attach('file', Buffer.from(csv), 'students.csv').expect(201);
    expect(res.body).toMatchObject({ total: 2, succeeded: 2, failed: 0 });
  });

  it('refuses to delete a subject that has questions, but deletes an unused one', async () => {
    const inUse = await prisma.subject.findFirstOrThrow({ where: { code: 'DVP301' } });
    const res = await request(app.getHttpServer()).delete(api(`/subjects/${inUse.id}`)).set(auth()).expect(400);
    expect(res.body.message).toMatch(/can't be deleted/i);

    await request(app.getHttpServer()).delete(api(`/subjects/${created.subjects[1]}`)).set(auth()).expect(200);
    created.subjects = created.subjects.filter((id) => id !== created.subjects[1]);
  });

  it('only lets admins manage subjects', async () => {
    const faculty = (await request(app.getHttpServer()).post(api('/auth/login')).send({ identifier: 'faculty@institution.edu', password: 'Faculty@12345' })).body.accessToken;
    await request(app.getHttpServer()).post(api('/subjects')).set({ Authorization: `Bearer ${faculty}` }).send({ name: 'Nope', courseId }).expect(403);
  });
});
