import { Question, QuestionOption, QuestionType } from '@prisma/client';

export const AUTO_GRADABLE_TYPES: QuestionType[] = [
  'MCQ',
  'MULTIPLE_SELECT',
  'TRUE_FALSE',
  'CODE_OUTPUT_PREDICTION',
];

export function isAutoGradable(type: QuestionType) {
  return AUTO_GRADABLE_TYPES.includes(type);
}

function normalize(text: string) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function autoGrade(
  question: Question & { options: QuestionOption[] },
  answer: { selectedOptionIds: string[]; textAnswer: string | null },
): { correct: boolean; score: number } | null {
  if (!isAutoGradable(question.type)) return null;

  if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
    const correctOption = question.options.find((o) => o.isCorrect);
    const selected = answer.selectedOptionIds[0];
    if (!selected) return { correct: false, score: 0 };
    const correct = !!correctOption && correctOption.id === selected;
    return { correct, score: correct ? question.marks : -question.negativeMarks || 0 };
  }

  if (question.type === 'MULTIPLE_SELECT') {
    const correctIds = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
    const selectedIds = new Set(answer.selectedOptionIds);
    if (selectedIds.size === 0) return { correct: false, score: 0 };
    const correct =
      correctIds.size === selectedIds.size && [...correctIds].every((id) => selectedIds.has(id));
    return { correct, score: correct ? question.marks : -question.negativeMarks || 0 };
  }

  if (question.type === 'CODE_OUTPUT_PREDICTION') {
    if (!answer.textAnswer) return { correct: false, score: 0 };
    const correct = normalize(answer.textAnswer) === normalize(question.expectedOutput ?? '');
    return { correct, score: correct ? question.marks : -question.negativeMarks || 0 };
  }

  return null;
}
