import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const [
      totalStudents,
      activeStudents,
      totalFaculty,
      totalAssessments,
      upcomingAssessments,
      activeAssessments,
      completedAssessments,
      studentsInProgress,
      studentsCompleted,
      flagged,
      terminated,
      scoreAgg,
    ] = await Promise.all([
      this.prisma.student.count(),
      this.prisma.student.count({ where: { user: { status: 'ACTIVE' } } }),
      this.prisma.faculty.count(),
      this.prisma.assessment.count(),
      this.prisma.assessment.count({ where: { startAt: { gt: now }, status: { in: ['DRAFT', 'SCHEDULED'] } } }),
      this.prisma.assessment.count({
        where: {
          startAt: { lte: now },
          endAt: { gte: now },
          status: { in: ['ACTIVE', 'SCHEDULED'] },
        },
      }),
      this.prisma.assessment.count({ where: { OR: [{ status: 'COMPLETED' }, { status: { in: ['ACTIVE', 'SCHEDULED'] }, endAt: { lt: now } }] } }),
      this.prisma.attemptRecord.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.attemptRecord.count({ where: { status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'] } } }),
      this.prisma.attemptRecord.count({ where: { violationCount: { gt: 0 } } }),
      this.prisma.attemptRecord.count({ where: { status: 'TERMINATED' } }),
      this.prisma.attemptRecord.aggregate({
        where: { finalScore: { not: null } },
        _avg: { finalScore: true },
        _max: { finalScore: true },
        _min: { finalScore: true },
      }),
    ]);

    const [assignments, attemptPairs] = await Promise.all([
      this.prisma.assessmentAssignment.findMany({ select: { assessmentId: true, studentId: true } }),
      this.prisma.attemptRecord.findMany({ select: { assessmentId: true, studentId: true }, distinct: ['assessmentId', 'studentId'] }),
    ]);
    const attemptedSet = new Set(attemptPairs.map((a) => `${a.assessmentId}:${a.studentId}`));
    const notStarted = assignments.filter((a) => !attemptedSet.has(`${a.assessmentId}:${a.studentId}`)).length;

    return {
      totalStudents,
      activeStudents,
      totalFaculty,
      totalAssessments,
      upcomingAssessments,
      activeAssessments,
      completedAssessments,
      studentsInProgress,
      studentsCompleted,
      notStarted,
      flagged,
      terminated,
      averageScore: scoreAgg._avg.finalScore,
      highestScore: scoreAgg._max.finalScore,
      lowestScore: scoreAgg._min.finalScore,
    };
  }

  async assessmentAnalytics(assessmentId: string) {
    const attempts = await this.prisma.attemptRecord.findMany({
      where: { assessmentId, finalScore: { not: null } },
      select: { finalScore: true },
    });
    const assessment = await this.prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
    const scores = attempts.map((a) => a.finalScore as number).sort((a, b) => a - b);

    if (!scores.length) {
      return { average: null, median: null, highest: null, lowest: null, passPercentage: null, failPercentage: null, attemptCount: 0 };
    }

    const average = scores.reduce((s, v) => s + v, 0) / scores.length;
    const mid = Math.floor(scores.length / 2);
    const median = scores.length % 2 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
    const passed = scores.filter((s) => s >= assessment.passingMarks).length;

    return {
      average: Math.round(average * 100) / 100,
      median,
      highest: scores[scores.length - 1],
      lowest: scores[0],
      passPercentage: Math.round((passed / scores.length) * 1000) / 10,
      failPercentage: Math.round(((scores.length - passed) / scores.length) * 1000) / 10,
      attemptCount: scores.length,
    };
  }

  async questionAnalytics(assessmentId: string) {
    const questions = await this.prisma.assessmentQuestion.findMany({
      where: { assessmentId },
      include: {
        question: {
          include: {
            studentAnswers: {
              where: { attempt: { assessmentId, status: { not: 'IN_PROGRESS' } } },
            },
          },
        },
      },
      orderBy: { order: 'asc' },
    });

    return questions.map(({ question }, index) => {
      const attempted = question.studentAnswers.filter((a) => a.isAnswered);
      const correct = attempted.filter((a) => a.autoCorrect === true || (a.manualScore ?? 0) >= question.marks);
      const total = attempted.length;
      return {
        questionNumber: index + 1,
        questionId: question.id,
        title: question.title,
        topic: question.topic,
        difficulty: question.difficulty,
        attempted: total,
        correct: correct.length,
        incorrect: total - correct.length,
        successPercentage: total ? Math.round((correct.length / total) * 1000) / 10 : null,
      };
    });
  }

  async topicAnalysis(subjectId: string) {
    const answers = await this.prisma.studentAnswer.findMany({
      where: { question: { subjectId }, isAnswered: true, attempt: { status: { not: 'IN_PROGRESS' } } },
      include: { question: { select: { topic: true, marks: true } } },
    });

    const byTopic = new Map<string, { obtained: number; max: number }>();
    for (const a of answers) {
      const topic = a.question.topic;
      const entry = byTopic.get(topic) ?? { obtained: 0, max: 0 };
      entry.obtained += (a.autoScore ?? 0) + (a.manualScore ?? 0);
      entry.max += a.question.marks;
      byTopic.set(topic, entry);
    }

    return [...byTopic.entries()].map(([topic, { obtained, max }]) => ({
      topic,
      averageScorePercent: max ? Math.round((obtained / max) * 1000) / 10 : 0,
    }));
  }

  async liveMonitoring(assessmentId: string) {
    const attempts = await this.prisma.attemptRecord.findMany({
      where: { assessmentId, status: { in: ['IN_PROGRESS', 'PAUSED', 'TERMINATED'] } },
      include: {
        student: { select: { name: true, studentCode: true } },
        assessment: { select: { questions: { select: { id: true } } } },
      },
    });

    return attempts.map((a) => {
      const remainingSeconds = a.deadlineAt ? Math.max(0, Math.floor((a.deadlineAt.getTime() - Date.now()) / 1000)) : null;
      const statusIcon =
        a.status === 'TERMINATED' ? 'TERMINATED' : a.violationCount > 0 ? 'WARNING' : 'ACTIVE';
      return {
        attemptId: a.id,
        studentName: a.student.name,
        studentCode: a.student.studentCode,
        currentQuestion: a.currentQuestionIndex + 1,
        totalQuestions: a.assessment.questions.length,
        remainingSeconds,
        violationCount: a.violationCount,
        status: statusIcon,
      };
    });
  }
}
