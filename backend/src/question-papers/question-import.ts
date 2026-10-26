// Turns uploaded question-paper content (CSV rows, Excel rows, or text extracted from a
// PDF) into *drafts* the faculty member reviews before anything is saved.

export type DraftQuestionType =
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

export interface DraftOption {
  text: string;
  isCorrect: boolean;
}

export interface QuestionDraft {
  rowNumber?: number;
  title: string;
  description: string;
  type: DraftQuestionType;
  marks: number;
  negativeMarks: number;
  topic: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  explanation?: string;
  shortAnswerKey?: string;
  options: DraftOption[];
  errors: string[];
}

export const OPTION_TYPES: DraftQuestionType[] = ['MCQ', 'MULTIPLE_SELECT', 'TRUE_FALSE'];

export const TEMPLATE_HEADERS = [
  'question',
  'type',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'optionE',
  'optionF',
  'correctAnswer',
  'marks',
  'negativeMarks',
  'topic',
  'difficulty',
  'explanation',
];

export const TEMPLATE_ROWS: string[][] = [
  ['Which library is used for tabular data in Python?', 'MCQ', 'NumPy', 'Pandas', 'Matplotlib', 'Flask', '', '', 'B', '2', '0.5', 'Pandas', 'EASY', 'Pandas provides DataFrames.'],
  ['Which of these are visualization libraries?', 'MULTIPLE_SELECT', 'Matplotlib', 'Seaborn', 'Pandas', 'Plotly', '', '', 'A,B,D', '3', '1', 'Visualization', 'MEDIUM', ''],
  ['Seaborn is built on top of Matplotlib.', 'TRUE_FALSE', '', '', '', '', '', '', 'True', '1', '0', 'Seaborn', 'EASY', ''],
  ['Name the Pandas structure that represents one column.', 'SHORT_ANSWER', '', '', '', '', '', '', 'Series', '1', '0', 'Pandas', 'EASY', ''],
  ['Explain how a chart can mislead viewers even when the data is accurate.', 'DESCRIPTIVE', '', '', '', '', '', '', '', '5', '0', 'Visualization Ethics', 'MEDIUM', ''],
];

export function normalizeHeader(h: unknown) {
  return String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const ALIASES = {
  question: ['question', 'questiontext', 'questiondescription', 'description', 'text', 'q'],
  type: ['type', 'questiontype'],
  marks: ['marks', 'mark', 'points', 'maxmarks'],
  negative: ['negativemarks', 'negativemark', 'negative', 'penalty'],
  topic: ['topic', 'unit', 'chapter'],
  difficulty: ['difficulty', 'level'],
  explanation: ['explanation', 'solution', 'remarks'],
  correct: ['correctanswer', 'correct', 'answer', 'answers', 'key', 'correctoption'],
};
const OPTION_COLUMNS = [
  ['optiona', 'option1', 'a'],
  ['optionb', 'option2', 'b'],
  ['optionc', 'option3', 'c'],
  ['optiond', 'option4', 'd'],
  ['optione', 'option5', 'e'],
  ['optionf', 'option6', 'f'],
];

export function hasQuestionColumn(headers: string[]) {
  const set = new Set(headers.map(normalizeHeader));
  return ALIASES.question.some((a) => set.has(a));
}

function pick(row: Record<string, unknown>, aliases: string[]) {
  for (const a of aliases) {
    const v = row[a];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function normalizeType(raw: string): DraftQuestionType | null {
  const t = normalizeHeader(raw);
  const map: Record<string, DraftQuestionType> = {
    mcq: 'MCQ',
    multiplechoice: 'MCQ',
    singlechoice: 'MCQ',
    single: 'MCQ',
    multipleselect: 'MULTIPLE_SELECT',
    multiselect: 'MULTIPLE_SELECT',
    multiplecorrect: 'MULTIPLE_SELECT',
    msq: 'MULTIPLE_SELECT',
    truefalse: 'TRUE_FALSE',
    tf: 'TRUE_FALSE',
    boolean: 'TRUE_FALSE',
    shortanswer: 'SHORT_ANSWER',
    short: 'SHORT_ANSWER',
    descriptive: 'DESCRIPTIVE',
    essay: 'DESCRIPTIVE',
    longanswer: 'DESCRIPTIVE',
    long: 'DESCRIPTIVE',
    theory: 'DESCRIPTIVE',
    coding: 'CODING',
    code: 'CODING',
    codecompletion: 'CODE_COMPLETION',
    codedebugging: 'CODE_DEBUGGING',
    debugging: 'CODE_DEBUGGING',
    codeoutput: 'CODE_OUTPUT_PREDICTION',
    outputprediction: 'CODE_OUTPUT_PREDICTION',
    codeoutputprediction: 'CODE_OUTPUT_PREDICTION',
    datasetanalysis: 'DATASET_ANALYSIS',
    visualizationinterpretation: 'VISUALIZATION_INTERPRETATION',
  };
  return map[t] ?? null;
}

function toNumber(raw: string, fallback: number) {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function singleLineTitle(description: string) {
  const line = description.replace(/\s+/g, ' ').trim();
  return line.length > 100 ? `${line.slice(0, 97)}...` : line;
}

// Parses "B", "A,C", "A; C", "2", or the literal option text into option indexes.
function parseCorrectIndexes(cell: string, options: DraftOption[]): number[] {
  if (!cell) return [];
  const byText = options.findIndex((o) => o.text.trim().toLowerCase() === cell.trim().toLowerCase());
  if (byText !== -1 && cell.trim().length > 1) return [byText];

  const indexes = new Set<number>();
  for (const token of cell.split(/[,;|&/\s]+/).filter(Boolean)) {
    if (/^[a-fA-F]$/.test(token)) indexes.add(token.toUpperCase().charCodeAt(0) - 65);
    else if (/^[1-6]$/.test(token)) indexes.add(Number(token) - 1);
  }
  return [...indexes];
}

export function validateDraft(d: QuestionDraft): string[] {
  const errors: string[] = [];
  if (!d.description.trim()) errors.push('Question text is missing');
  if (!Number.isFinite(d.marks) || d.marks <= 0) errors.push('Marks must be a positive number');
  if (!Number.isFinite(d.negativeMarks) || d.negativeMarks < 0) errors.push('Negative marks must be 0 or more');

  if (OPTION_TYPES.includes(d.type)) {
    const filled = d.options.filter((o) => o.text.trim());
    const correct = filled.filter((o) => o.isCorrect).length;
    if (filled.length < 2) errors.push('At least two options are required');
    if (d.type === 'MULTIPLE_SELECT') {
      if (correct < 1) errors.push('Mark at least one correct option');
    } else if (correct !== 1) {
      errors.push('Mark exactly one correct option');
    }
  }
  return errors;
}

export function rowsToDrafts(rows: Record<string, unknown>[]): QuestionDraft[] {
  const drafts: QuestionDraft[] = [];

  rows.forEach((row, idx) => {
    const description = pick(row, ALIASES.question);
    const hasContent = Object.values(row).some((v) => v != null && String(v).trim() !== '');
    if (!hasContent) return;

    const errors: string[] = [];
    const typeCell = pick(row, ALIASES.type);
    const correctCell = pick(row, ALIASES.correct);

    let options: DraftOption[] = OPTION_COLUMNS.map((aliases) => pick(row, aliases))
      .filter(Boolean)
      .map((text) => ({ text, isCorrect: false }));

    let type: DraftQuestionType | null = typeCell ? normalizeType(typeCell) : null;
    if (typeCell && !type) errors.push(`Unknown question type "${typeCell}"`);

    if (!type) {
      type = options.length >= 2 ? 'MCQ' : 'DESCRIPTIVE';
    }

    let shortAnswerKey: string | undefined;
    if (type === 'TRUE_FALSE') {
      const truthy = /^(t|true|yes|y)$/i.test(correctCell);
      const falsy = /^(f|false|no|n)$/i.test(correctCell);
      options = [
        { text: 'True', isCorrect: truthy },
        { text: 'False', isCorrect: falsy },
      ];
    } else if (OPTION_TYPES.includes(type)) {
      const indexes = parseCorrectIndexes(correctCell, options);
      indexes.forEach((i) => {
        if (options[i]) options[i].isCorrect = true;
      });
      if (type === 'MCQ' && indexes.length > 1) type = 'MULTIPLE_SELECT';
    } else {
      options = [];
      if (type === 'SHORT_ANSWER' && correctCell) shortAnswerKey = correctCell;
    }

    const marks = toNumber(pick(row, ALIASES.marks), 1);
    const negativeMarks = toNumber(pick(row, ALIASES.negative), 0);
    const difficultyRaw = pick(row, ALIASES.difficulty).toUpperCase();
    const difficulty = (['EASY', 'MEDIUM', 'HARD'].includes(difficultyRaw) ? difficultyRaw : 'MEDIUM') as QuestionDraft['difficulty'];

    const draft: QuestionDraft = {
      rowNumber: idx + 2,
      title: singleLineTitle(description),
      description,
      type,
      marks,
      negativeMarks,
      topic: pick(row, ALIASES.topic) || 'General',
      difficulty,
      explanation: pick(row, ALIASES.explanation) || undefined,
      shortAnswerKey,
      options,
      errors,
    };
    draft.errors = [...errors, ...validateDraft(draft)];
    drafts.push(draft);
  });

  return drafts;
}

// ── PDF text → drafts (heuristic; the faculty member always reviews the result) ──

const QUESTION_START = /^\s*(?:q(?:uestion)?\.?\s*)?(\d{1,3})\s*[.):\-]\s*(.*)$/i;
const OPTION_LINE = /^\s*\(?([A-Fa-f])[.)]\s+(.+)$/;
const ANSWER_LINE = /^\s*(?:ans(?:wer)?|correct(?:\s+answer)?|key)\s*[:\-]\s*\(?([A-Fa-f](?:\s*[,&/;]\s*[A-Fa-f])*)\)?\s*$/i;
const MARKS_TAG = /[[(]\s*(\d+(?:\.\d+)?)\s*(?:marks?|mks?|m)\s*[\])]/i;

interface Block {
  number: number;
  lines: string[];
  options: string[];
  answers: string[];
  marks?: number;
  lastWasOption: boolean;
}

export function textToDrafts(text: string): { drafts: QuestionDraft[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let current: Block | null = null;
  let lastNumber = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const start = line.match(QUESTION_START);
    if (start) {
      const n = Number(start[1]);
      if (n === lastNumber + 1 || n === 1) {
        current = { number: n, lines: [], options: [], answers: [], lastWasOption: false };
        blocks.push(current);
        lastNumber = n;
        if (start[2]) current.lines.push(start[2]);
        continue;
      }
    }
    if (!current) continue;

    const answer = line.match(ANSWER_LINE);
    if (answer) {
      current.answers = answer[1].split(/[,&/;\s]+/).filter(Boolean).map((a) => a.toUpperCase());
      current.lastWasOption = false;
      continue;
    }

    const option = line.match(OPTION_LINE);
    if (option) {
      current.options.push(option[2].trim());
      current.lastWasOption = true;
      continue;
    }

    if (current.lastWasOption && current.options.length) {
      current.options[current.options.length - 1] += ` ${line}`;
    } else {
      current.lines.push(line);
    }
  }

  const drafts = blocks.map((b): QuestionDraft => {
    let description = b.lines.join('\n').trim();
    const tag = description.match(MARKS_TAG) ?? b.options.join(' ').match(MARKS_TAG);
    if (tag) {
      b.marks = Number(tag[1]);
      description = description.replace(MARKS_TAG, '').replace(/[ \t]+\n/g, '\n').trim();
    }

    const options: DraftOption[] = b.options.map((optText, i) => ({
      text: optText.replace(MARKS_TAG, '').trim(),
      isCorrect: b.answers.includes(String.fromCharCode(65 + i)),
    }));

    const isChoice = options.length >= 2;
    const type: DraftQuestionType = isChoice ? (b.answers.length > 1 ? 'MULTIPLE_SELECT' : 'MCQ') : 'DESCRIPTIVE';

    const draft: QuestionDraft = {
      rowNumber: b.number,
      title: singleLineTitle(description),
      description,
      type,
      marks: b.marks ?? 1,
      negativeMarks: 0,
      topic: 'General',
      difficulty: 'MEDIUM',
      options: isChoice ? options : [],
      errors: [],
    };
    draft.errors = validateDraft(draft);
    return draft;
  });

  if (text.trim().length < 20) {
    warnings.push('No readable text found — this looks like a scanned PDF. The file is saved as the reference paper; add the questions manually.');
  } else if (!drafts.length) {
    warnings.push('Could not detect numbered questions (expected "1.", "Q2)" etc.). The PDF is saved as the reference paper; add the questions manually.');
  } else {
    warnings.push('Questions were detected automatically from the PDF — review wording, marks, and correct answers before importing.');
  }
  return { drafts, warnings };
}
