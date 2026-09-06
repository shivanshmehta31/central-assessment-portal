import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// End-to-end coverage of the golden path described in the spec:
// admin creates an assessment -> assigns a student -> student takes the
// exam with autosave -> submits -> violations are logged -> admin can
// override them. Runs against a real Postgres database (DATABASE_URL),
// creating and tearing down its own fixtures so it never touches seed data.
describe('Central Assessment Portal (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let studentToken: string;
  let studentProfileId: string;
  let departmentId: string;
  let courseId: string;
  let subjectId: string;
  let questionId: string;
  let assessmentId: string;
  let attemptId: string;

  const unique = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up everything this test created, in FK-safe order.
    if (attemptId) {
      await prisma.violation.deleteMany({ where: { attemptId } });
      await prisma.studentAnswer.deleteMany({ where: { attemptId } });
      await prisma.attemptRecord.deleteMany({ where: { id: attemptId } });
    }
    if (assessmentId) {
      await prisma.assessmentAssignment.deleteMany({ where: { assessmentId } });
      await prisma.assessmentQuestion.deleteMany({ where: { assessmentId } });
      await prisma.assessment.deleteMany({ where: { id: assessmentId } });
    }
    if (questionId) await prisma.question.deleteMany({ where: { id: questionId } });
    if (subjectId) await prisma.subject.deleteMany({ where: { id: subjectId } });
    if (courseId) await prisma.course.deleteMany({ where: { id: courseId } });
    if (departmentId) await prisma.department.deleteMany({ where: { id: departmentId } });

    await app.close();
  });

  it('logs in the seeded admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'admin@institution.edu', password: 'Admin@12345', expectedRole: 'ADMIN' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('ADMIN');
    adminToken = res.body.accessToken;
  });

  it('rejects an incorrect password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'admin@institution.edu', password: 'wrong-password' })
      .expect(401);
  });

  it('creates a department, course, and subject', async () => {
    const dept = await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `E2E Dept ${unique}`, code: `E2E-${unique}` })
      .expect(201);
    departmentId = dept.body.id;

    const course = await request(app.getHttpServer())
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `E2E Course ${unique}`, code: `E2EC-${unique}`, departmentId })
      .expect(201);
    courseId = course.body.id;

    const subject = await request(app.getHttpServer())
      .post('/api/v1/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `E2E Subject ${unique}`, code: `E2ES-${unique}`, courseId })
      .expect(201);
    subjectId = subject.body.id;
  });

  it('creates an MCQ question in the question bank', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'E2E sample question',
        description: 'Which library is used for tabular data in Python?',
        type: 'MCQ',
        subjectId,
        topic: 'Pandas',
        marks: 2,
        negativeMarks: 0.5,
        options: [
          { text: 'NumPy', isCorrect: false },
          { text: 'Pandas', isCorrect: true },
        ],
      })
      .expect(201);
    questionId = res.body.id;
    expect(res.body.options).toHaveLength(2);
  });

  it('creates, publishes, and assigns an assessment to a seeded student', async () => {
    const student = await prisma.student.findFirstOrThrow({ where: { studentCode: 'CSE2026005' } });
    studentProfileId = student.id;

    const now = new Date();
    const created = await request(app.getHttpServer())
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `E2E Assessment ${unique}`,
        subjectId,
        type: 'QUIZ',
        totalMarks: 2,
        passingMarks: 1,
        durationMinutes: 30,
        startAt: new Date(now.getTime() - 60_000).toISOString(),
        endAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
        violationLimit: 2,
        violationAction: 'AUTO_SUBMIT',
      })
      .expect(201);
    assessmentId = created.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/assessments/${assessmentId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionIds: [questionId] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/assessments/${assessmentId}/assign-students`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [studentProfileId] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/assessments/${assessmentId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  it('logs in the assigned student and sees the assessment as available', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'CSE2026005', password: 'Student@12345', expectedRole: 'STUDENT' })
      .expect(201);
    studentToken = res.body.accessToken;

    const available = await request(app.getHttpServer())
      .get('/api/v1/attempts/available')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const match = available.body.find((a: any) => a.assessment.id === assessmentId);
    expect(match).toBeDefined();
    expect(match.status).toBe('Available');
  });

  it('starts the attempt with a server-authoritative deadline', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/attempts/start')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ assessmentId })
      .expect(201);

    attemptId = res.body.attemptId;
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.remainingSeconds).toBeGreaterThan(0);
    expect(res.body.remainingSeconds).toBeLessThanOrEqual(30 * 60);
    expect(res.body.questions).toHaveLength(1);
  });

  it('autosaves an answer', async () => {
    const state = await request(app.getHttpServer())
      .get(`/api/v1/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const correctOptionId = state.body.questions[0].options.find((o: any) => o.text === 'Pandas').id;

    await request(app.getHttpServer())
      .post(`/api/v1/attempts/${attemptId}/save-answer`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ questionId, selectedOptionIds: [correctOptionId] })
      .expect(201);

    const refetched = await request(app.getHttpServer())
      .get(`/api/v1/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(refetched.body.summary.answered).toBe(1);
  });

  it('logs a tab-switch violation without terminating the attempt', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/attempts/${attemptId}/violations`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ type: 'TAB_SWITCH', questionIndexAtTime: 0, remainingTimeSeconds: 1000 })
      .expect(201);

    expect(res.body.violationCount).toBe(1);
    expect(res.body.examTerminated).toBe(false);
  });

  it('submits the attempt and auto-grades the correct MCQ answer', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);

    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.autoScore).toBe(2);
    expect(res.body.resultStatus).toBe('EVALUATED');
  });

  it('rejects a second submission of an already-submitted attempt', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(400);
  });

  it("lets the admin see the logged violation in incident management and reset its count", async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/v1/violations?assessmentId=${assessmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const violation = list.body.find((v: any) => v.attempt.id === attemptId);
    expect(violation).toBeDefined();

    await request(app.getHttpServer())
      .post(`/api/v1/violations/${violation.id}/override`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'RESET_COUNT', note: 'e2e override' })
      .expect(201);
  });

  it('enforces role-based access control on admin-only routes', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'should be forbidden' })
      .expect(403);
  });
});
