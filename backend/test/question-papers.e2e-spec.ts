import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Paper-based flow: faculty creates a question paper (manual + CSV import), uploads answer
// sheets, evaluates them; admin publishes; the student sees the result. Also checks that
// another faculty member cannot reach the paper or its files.
describe('Question papers & answer sheets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let facultyToken: string;
  let otherFacultyToken: string;
  let adminToken: string;
  let studentToken: string;
  let paperId: string;
  let attemptId: string;
  let fileId: string;
  let otherFacultyUserId: string;
  const unique = Date.now();

  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  const api = (path: string) => `/api/v1${path}`;

  const login = async (identifier: string, password: string) =>
    (await request(app.getHttpServer()).post(api('/auth/login')).send({ identifier, password })).body.accessToken as string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    // A second faculty member with no link to the paper.
    const dept = await prisma.department.findFirstOrThrow();
    const other = await prisma.user.create({
      data: {
        email: `other-${unique}@institution.edu`,
        passwordHash: await bcrypt.hash('Other@12345', 10),
        role: 'FACULTY',
        faculty: { create: { name: 'Other Faculty', facultyCode: `OF-${unique}`, departmentId: dept.id } },
      },
    });
    otherFacultyUserId = other.id;

    facultyToken = await login('faculty@institution.edu', 'Faculty@12345');
    otherFacultyToken = await login(`other-${unique}@institution.edu`, 'Other@12345');
    adminToken = await login('admin@institution.edu', 'Admin@12345');
    studentToken = await login('CSE2026007', 'Student@12345');
  });

  afterAll(async () => {
    if (paperId) {
      const links = await prisma.assessmentQuestion.findMany({ where: { assessmentId: paperId }, select: { questionId: true } });
      const attempts = await prisma.attemptRecord.findMany({ where: { assessmentId: paperId }, select: { answerSheetFileId: true } });
      await prisma.notification.deleteMany({ where: { metadata: { path: ['assessmentId'], equals: paperId } } });
      await prisma.attemptRecord.deleteMany({ where: { assessmentId: paperId } });
      const paper = await prisma.assessment.findUnique({ where: { id: paperId } });
      await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: paperId } });
      await prisma.assessment.deleteMany({ where: { id: paperId } });
      await prisma.question.deleteMany({ where: { id: { in: links.map((l) => l.questionId) } } });
      await prisma.storedFile.deleteMany({
        where: { id: { in: [...attempts.map((a) => a.answerSheetFileId), paper?.questionPaperFileId].filter(Boolean) as string[] } },
      });
    }
    await prisma.user.deleteMany({ where: { id: otherFacultyUserId } });
    await app.close();
  });

  it('lists only the subjects the faculty is assigned to', async () => {
    const res = await request(app.getHttpServer()).get(api('/question-papers/subjects')).set('Authorization', `Bearer ${facultyToken}`).expect(200);
    expect(res.body.map((s: any) => s.code)).toContain('DVP301');
  });

  it('refuses to create a paper for a subject the faculty is not assigned to', async () => {
    const subject = await prisma.subject.findFirstOrThrow({ where: { code: 'DVP301' } });
    await request(app.getHttpServer())
      .post(api('/question-papers'))
      .set('Authorization', `Bearer ${otherFacultyToken}`)
      .send({ title: 'nope', subjectId: subject.id })
      .expect(403);
  });

  it('creates a paper-based question paper', async () => {
    const subject = await prisma.subject.findFirstOrThrow({ where: { code: 'DVP301' } });
    const res = await request(app.getHttpServer())
      .post(api('/question-papers'))
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ title: `E2E Paper ${unique}`, subjectId: subject.id, passingMarks: 4, durationMinutes: 90 })
      .expect(201);
    paperId = res.body.id;
    expect(res.body.mode).toBe('OFFLINE');
  });

  it('adds a question manually and keeps total marks in sync', async () => {
    const paper = await prisma.assessment.findUniqueOrThrow({ where: { id: paperId } });
    await request(app.getHttpServer())
      .post(api(`/question-papers/${paperId}/questions`))
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'Manual Q', description: 'Define a DataFrame.', type: 'DESCRIPTIVE', subjectId: paper.subjectId, topic: 'Pandas', marks: 4,
      })
      .expect(201);
    const detail = await request(app.getHttpServer()).get(api(`/question-papers/${paperId}`)).set('Authorization', `Bearer ${facultyToken}`).expect(200);
    expect(detail.body.totalMarks).toBe(4);
  });

  it('rejects a choice question with no correct option (manual add) and accepts it once marked', async () => {
    const paper = await prisma.assessment.findUniqueOrThrow({ where: { id: paperId } });
    const body = (isCorrect: boolean) => ({
      title: 'TF', description: 'Seaborn wraps Matplotlib.', type: 'TRUE_FALSE', subjectId: paper.subjectId, topic: 'Seaborn', marks: 1,
      options: [{ text: 'True', isCorrect }, { text: 'False', isCorrect: false }],
    });
    await request(app.getHttpServer()).post(api(`/question-papers/${paperId}/questions`)).set('Authorization', `Bearer ${facultyToken}`).send(body(false)).expect(400);
    const ok = await request(app.getHttpServer()).post(api(`/question-papers/${paperId}/questions`)).set('Authorization', `Bearer ${facultyToken}`).send(body(true)).expect(201);

    // and it can be removed again (no scores yet) so later totals in this suite are unchanged
    await request(app.getHttpServer()).delete(api(`/question-papers/${paperId}/questions/${ok.body.id}`)).set('Authorization', `Bearer ${facultyToken}`).expect(200);
    // removal archives the question; delete the archived row so the suite leaves nothing behind
    const archived = await prisma.question.findUniqueOrThrow({ where: { id: ok.body.id } });
    expect(archived.isActive).toBe(false);
    await prisma.question.delete({ where: { id: ok.body.id } });
  });

  it('imports questions from an uploaded CSV (parse → review → commit)', async () => {
    const csv = 'question,type,optionA,optionB,correctAnswer,marks\n"Pick the library",MCQ,NumPy,Pandas,B,2\n"Explain EDA",DESCRIPTIVE,,,,4\n';
    const parsed = await request(app.getHttpServer())
      .post(api(`/question-papers/${paperId}/parse`))
      .set('Authorization', `Bearer ${facultyToken}`)
      .attach('file', Buffer.from(csv), 'paper.csv')
      .expect(201);
    expect(parsed.body.drafts).toHaveLength(2);
    expect(parsed.body.drafts[0].errors).toEqual([]);
    fileId = parsed.body.file.id;

    await request(app.getHttpServer())
      .post(api(`/question-papers/${paperId}/questions/bulk`))
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ drafts: parsed.body.drafts.map(({ errors, rowNumber, ...d }: any) => d) })
      .expect(201);

    const detail = await request(app.getHttpServer()).get(api(`/question-papers/${paperId}`)).set('Authorization', `Bearer ${facultyToken}`).expect(200);
    expect(detail.body.questions).toHaveLength(3);
    expect(detail.body.totalMarks).toBe(10);
  });

  it('rejects an import that has invalid questions', async () => {
    await request(app.getHttpServer())
      .post(api(`/question-papers/${paperId}/questions/bulk`))
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ drafts: [{ title: 'bad', description: 'MCQ with no options', type: 'MCQ', marks: 1 }] })
      .expect(400);
  });

  it('rejects files that only pretend to be a supported type', async () => {
    await request(app.getHttpServer())
      .post(api(`/question-papers/${paperId}/parse`))
      .set('Authorization', `Bearer ${facultyToken}`)
      .attach('file', Buffer.from('<html><script>alert(1)</script></html>'), 'evil.pdf')
      .expect(400);
  });

  it('uploads an answer sheet for a student', async () => {
    const student = await prisma.student.findFirstOrThrow({ where: { studentCode: 'CSE2026007' } });
    await request(app.getHttpServer())
      .post(api(`/question-papers/${paperId}/answer-sheets`))
      .set('Authorization', `Bearer ${facultyToken}`)
      .field('studentId', student.id)
      .attach('file', PDF, 'sheet.pdf')
      .expect(201);

    const list = await request(app.getHttpServer()).get(api(`/question-papers/${paperId}/answer-sheets`)).set('Authorization', `Bearer ${facultyToken}`).expect(200);
    expect(list.body.items).toHaveLength(1);
    attemptId = list.body.items[0].attemptId;
    expect(list.body.items[0].resultStatus).toBe('PENDING_EVALUATION');
  });

  it('bulk-uploads sheets matched by Student ID file name and reports unmatched files', async () => {
    const res = await request(app.getHttpServer())
      .post(api(`/question-papers/${paperId}/answer-sheets/bulk`))
      .set('Authorization', `Bearer ${facultyToken}`)
      .attach('files', PDF, 'CSE2026008.pdf')
      .attach('files', PDF, 'unknown-person.pdf')
      .expect(201);
    expect(res.body.succeeded).toBe(1);
    expect(res.body.failed).toBe(1);
    // clean up the extra sheet so later assertions about the single sheet stay simple
    const list = await request(app.getHttpServer()).get(api(`/question-papers/${paperId}/answer-sheets`)).set('Authorization', `Bearer ${facultyToken}`);
    const extra = list.body.items.find((i: any) => i.student.studentCode === 'CSE2026008');
    await request(app.getHttpServer()).delete(api(`/question-papers/${paperId}/answer-sheets/${extra.attemptId}`)).set('Authorization', `Bearer ${facultyToken}`).expect(200);
  });

  it('serves the sheet to the evaluator but not to another faculty member or a student', async () => {
    const detail = await request(app.getHttpServer()).get(api(`/question-papers/${paperId}/answer-sheets/${attemptId}`)).set('Authorization', `Bearer ${facultyToken}`).expect(200);
    const sheetId = detail.body.file.id;

    const ok = await request(app.getHttpServer()).get(api(`/files/${sheetId}`)).set('Authorization', `Bearer ${facultyToken}`).expect(200);
    expect(ok.headers['content-type']).toContain('application/pdf');
    expect(ok.headers['content-security-policy']).toContain('sandbox');

    await request(app.getHttpServer()).get(api(`/files/${sheetId}`)).set('Authorization', `Bearer ${otherFacultyToken}`).expect(404);
    await request(app.getHttpServer()).get(api(`/files/${sheetId}`)).set('Authorization', `Bearer ${studentToken}`).expect(403);
    await request(app.getHttpServer()).get(api(`/question-papers/${paperId}`)).set('Authorization', `Bearer ${otherFacultyToken}`).expect(404);
  });

  it('rejects scores above a question\'s maximum and finalizing with unscored questions', async () => {
    const detail = await request(app.getHttpServer()).get(api(`/question-papers/${paperId}/answer-sheets/${attemptId}`)).set('Authorization', `Bearer ${facultyToken}`);
    const [q1, q2] = detail.body.questions;

    await request(app.getHttpServer())
      .put(api(`/question-papers/${paperId}/answer-sheets/${attemptId}/scores`))
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ scores: [{ questionId: q1.questionId, score: q1.marks + 1 }] })
      .expect(400);

    await request(app.getHttpServer())
      .put(api(`/question-papers/${paperId}/answer-sheets/${attemptId}/scores`))
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ scores: [{ questionId: q2.questionId, score: 1 }], finalize: true })
      .expect(400);
  });

  it('evaluates and finalizes the sheet', async () => {
    const detail = await request(app.getHttpServer()).get(api(`/question-papers/${paperId}/answer-sheets/${attemptId}`)).set('Authorization', `Bearer ${facultyToken}`);
    const scores = detail.body.questions.map((q: any) => ({ questionId: q.questionId, score: q.marks, feedback: 'ok' }));

    const res = await request(app.getHttpServer())
      .put(api(`/question-papers/${paperId}/answer-sheets/${attemptId}/scores`))
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ scores, finalize: true })
      .expect(200);
    expect(res.body.totalScore).toBe(10);
    expect(res.body.resultStatus).toBe('EVALUATED');
  });

  it('lets the admin publish and the student see the paper-based result', async () => {
    await request(app.getHttpServer()).post(api(`/results/assessments/${paperId}/publish`)).set('Authorization', `Bearer ${adminToken}`).expect(201);

    const mine = await request(app.getHttpServer()).get(api('/results/me')).set('Authorization', `Bearer ${studentToken}`).expect(200);
    const row = mine.body.find((r: any) => r.attemptId === attemptId);
    expect(row.obtainedMarks).toBe(10);
    expect(row.passed).toBe(true);
  });

  it('no longer allows editing a published sheet', async () => {
    await request(app.getHttpServer())
      .put(api(`/question-papers/${paperId}/answer-sheets/${attemptId}/scores`))
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ scores: [] })
      .expect(400);
  });

  it('keeps paper-based assessments out of the online evaluation list', async () => {
    const res = await request(app.getHttpServer()).get(api('/evaluation/assessments')).set('Authorization', `Bearer ${facultyToken}`).expect(200);
    expect(res.body.find((a: any) => a.id === paperId)).toBeUndefined();
  });
});
