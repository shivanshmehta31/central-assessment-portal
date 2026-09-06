export type UserRole = 'ADMIN' | 'FACULTY' | 'STUDENT';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  profileId: string;
  name: string;
  mustResetPassword: boolean;
}

export type QuestionType =
  | 'MCQ'
  | 'MULTIPLE_SELECT'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'DESCRIPTIVE'
  | 'CODING'
  | 'CODE_COMPLETION'
  | 'CODE_DEBUGGING'
  | 'CODE_OUTPUT_PREDICTION'
  | 'DATASET_ANALYSIS'
  | 'VISUALIZATION_INTERPRETATION';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: 'Multiple Choice',
  MULTIPLE_SELECT: 'Multiple Select',
  TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short Answer',
  DESCRIPTIVE: 'Descriptive',
  CODING: 'Coding',
  CODE_COMPLETION: 'Code Completion',
  CODE_DEBUGGING: 'Code Debugging',
  CODE_OUTPUT_PREDICTION: 'Code Output Prediction',
  DATASET_ANALYSIS: 'Dataset Analysis',
  VISUALIZATION_INTERPRETATION: 'Visualization Interpretation',
};

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface ExamQuestion {
  index: number;
  questionId: string;
  type: QuestionType;
  title: string;
  description: string;
  difficulty: string;
  marks: number;
  negativeMarks: number;
  imageUrl?: string | null;
  options: QuestionOption[];
  characterLimit?: number | null;
  wordLimit?: number | null;
  starterCode?: string | null;
  language?: string | null;
  incorrectCode?: string | null;
  constraints?: string | null;
  sampleInput?: string | null;
  sampleOutput?: string | null;
  datasetId?: string | null;
  allowDatasetDownload?: boolean;
  answer: {
    selectedOptionIds: string[];
    textAnswer: string | null;
    codeAnswer: string | null;
    isMarkedForReview: boolean;
    isAnswered: boolean;
  } | null;
}

export interface AttemptState {
  attemptId: string;
  assessment: {
    id: string;
    title: string;
    requireFullscreen: boolean;
    violationLimit: number;
    violationAction: 'LOG_ONLY' | 'WARN' | 'AUTO_SUBMIT' | 'TERMINATE';
  };
  status: string;
  currentQuestionIndex: number;
  violationCount: number;
  remainingSeconds: number | null;
  deadlineAt: string | null;
  questions: ExamQuestion[];
  summary: { total: number; answered: number; markedForReview: number; unanswered: number };
}

export interface AvailableAssessment {
  assessment: {
    id: string;
    title: string;
    type: string;
    subject: string;
    totalMarks: number;
    durationMinutes: number;
    startAt: string;
    endAt: string;
    totalQuestions: number;
    maxAttempts: number;
  };
  status: 'Upcoming' | 'Available' | 'In Progress' | 'Completed' | 'Expired' | 'Unavailable';
  attemptsUsed: number;
  activeAttemptId: string | null;
}
