import { autoGrade, isAutoGradable } from '../auto-evaluation.util';
import { Question, QuestionOption } from '@prisma/client';

function makeQuestion(overrides: Partial<Question> = {}, options: Partial<QuestionOption>[] = []): Question & { options: QuestionOption[] } {
  return {
    id: 'q1',
    title: 't',
    description: 'd',
    type: 'MCQ',
    difficulty: 'MEDIUM',
    subjectId: 's1',
    topic: 'topic',
    subtopic: null,
    marks: 2,
    negativeMarks: 0.5,
    tags: [],
    explanation: null,
    imageUrl: null,
    shortAnswerKey: null,
    characterLimit: null,
    wordLimit: null,
    starterCode: null,
    language: 'python',
    incorrectCode: null,
    expectedOutput: null,
    constraints: null,
    sampleInput: null,
    sampleOutput: null,
    datasetId: null,
    allowedLibraries: [],
    allowDatasetDownload: false,
    createdById: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
    options: options.map((o, i) => ({
      id: o.id ?? `opt${i}`,
      questionId: 'q1',
      text: o.text ?? `Option ${i}`,
      isCorrect: o.isCorrect ?? false,
      order: i,
    })),
  } as Question & { options: QuestionOption[] };
}

describe('autoGrade', () => {
  it('is not auto-gradable for descriptive/coding questions', () => {
    expect(isAutoGradable('DESCRIPTIVE')).toBe(false);
    expect(isAutoGradable('CODING')).toBe(false);
    expect(isAutoGradable('MCQ')).toBe(true);
  });

  it('awards full marks for a correct MCQ answer', () => {
    const q = makeQuestion({ type: 'MCQ' }, [
      { id: 'a', isCorrect: false },
      { id: 'b', isCorrect: true },
    ]);
    const result = autoGrade(q, { selectedOptionIds: ['b'], textAnswer: null });
    expect(result).toEqual({ correct: true, score: 2 });
  });

  it('applies negative marking for an incorrect MCQ answer', () => {
    const q = makeQuestion({ type: 'MCQ' }, [
      { id: 'a', isCorrect: false },
      { id: 'b', isCorrect: true },
    ]);
    const result = autoGrade(q, { selectedOptionIds: ['a'], textAnswer: null });
    expect(result).toEqual({ correct: false, score: -0.5 });
  });

  it('gives zero (not negative) marks for an unanswered MCQ', () => {
    const q = makeQuestion({ type: 'MCQ' }, [{ id: 'a', isCorrect: true }]);
    const result = autoGrade(q, { selectedOptionIds: [], textAnswer: null });
    expect(result).toEqual({ correct: false, score: 0 });
  });

  it('requires an exact set match for MULTIPLE_SELECT', () => {
    const q = makeQuestion({ type: 'MULTIPLE_SELECT', marks: 3, negativeMarks: 1 }, [
      { id: 'a', isCorrect: true },
      { id: 'b', isCorrect: true },
      { id: 'c', isCorrect: false },
    ]);
    expect(autoGrade(q, { selectedOptionIds: ['a', 'b'], textAnswer: null })).toEqual({ correct: true, score: 3 });
    expect(autoGrade(q, { selectedOptionIds: ['a'], textAnswer: null })).toEqual({ correct: false, score: -1 });
    expect(autoGrade(q, { selectedOptionIds: ['a', 'b', 'c'], textAnswer: null })).toEqual({ correct: false, score: -1 });
  });

  it('normalizes whitespace when checking CODE_OUTPUT_PREDICTION', () => {
    const q = makeQuestion({ type: 'CODE_OUTPUT_PREDICTION', expectedOutput: '[6 7 8]', marks: 2, negativeMarks: 0 });
    expect(autoGrade(q, { selectedOptionIds: [], textAnswer: '  [6   7 8] ' })).toEqual({ correct: true, score: 2 });
    expect(autoGrade(q, { selectedOptionIds: [], textAnswer: '[6 7 9]' })).toEqual({ correct: false, score: 0 });
  });

  it('returns null for question types requiring manual evaluation', () => {
    const q = makeQuestion({ type: 'DESCRIPTIVE' });
    expect(autoGrade(q, { selectedOptionIds: [], textAnswer: 'my essay' })).toBeNull();
  });
});
