import { api } from './api';
import type { QuestionType } from './types';

export interface DraftOption {
  text: string;
  isCorrect: boolean;
}

export interface QuestionDraft {
  rowNumber?: number;
  title: string;
  description: string;
  type: QuestionType;
  marks: number;
  negativeMarks: number;
  topic: string;
  difficulty: string;
  explanation?: string;
  shortAnswerKey?: string;
  options: DraftOption[];
  errors: string[];
}

export interface FileMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface PaperSummary {
  id: string;
  title: string;
  description: string | null;
  type: string;
  totalMarks: number;
  passingMarks: number;
  durationMinutes: number;
  startAt: string;
  subject: { id: string; name: string };
  questionPaperFile: { id: string; filename: string } | null;
  _count: { questions: number };
  sheetCount: number;
  pendingCount: number;
  evaluatedCount: number;
}

export interface PaperQuestion {
  order: number;
  question: {
    id: string;
    title: string;
    description: string;
    type: QuestionType;
    topic: string;
    difficulty: string;
    marks: number;
    negativeMarks: number;
    explanation: string | null;
    shortAnswerKey: string | null;
    starterCode: string | null;
    incorrectCode: string | null;
    expectedOutput: string | null;
    sampleInput: string | null;
    sampleOutput: string | null;
    constraints: string | null;
    options: DraftOption[];
  };
}

export interface PaperDetail extends Omit<PaperSummary, '_count' | 'sheetCount' | 'pendingCount' | 'evaluatedCount' | 'questionPaperFile'> {
  subjectId: string;
  questionPaperFile: FileMeta | null;
  questions: PaperQuestion[];
  _count: { attempts: number };
}

export const OPTION_TYPES: QuestionType[] = ['MCQ', 'MULTIPLE_SELECT', 'TRUE_FALSE'];

// Mirrors the server-side validation so the review screen can flag problems as you edit.
export function validateDraft(d: QuestionDraft): string[] {
  const errors: string[] = [];
  if (!d.description.trim()) errors.push('Question text is missing');
  if (!Number.isFinite(d.marks) || d.marks <= 0) errors.push('Marks must be a positive number');
  if (OPTION_TYPES.includes(d.type)) {
    const filled = d.options.filter((o) => o.text.trim());
    const correct = filled.filter((o) => o.isCorrect).length;
    if (filled.length < 2) errors.push('At least two options are required');
    if (d.type === 'MULTIPLE_SELECT' ? correct < 1 : correct !== 1) {
      errors.push(d.type === 'MULTIPLE_SELECT' ? 'Mark at least one correct option' : 'Mark exactly one correct option');
    }
  }
  return errors;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Opens an uploaded file in a new tab. The tab is opened first (synchronously) so
// browsers don't treat it as a blocked popup, then pointed at the authenticated blob.
export async function viewFile(fileId: string) {
  const tab = window.open('', '_blank');
  try {
    const blob = await api.blob(`/files/${fileId}`);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
