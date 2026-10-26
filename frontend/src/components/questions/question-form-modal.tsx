'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { Button, ErrorBanner, Input, Label, Modal, Select, Textarea } from '@/components/ui/primitives';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/lib/types';

export interface QuestionOptionInput {
  text: string;
  isCorrect: boolean;
}

// Shape accepted by POST/PATCH question endpoints.
export interface QuestionPayload {
  title: string;
  description: string;
  type: QuestionType;
  subjectId: string;
  topic: string;
  difficulty: string;
  marks: number;
  negativeMarks: number;
  explanation?: string;
  options?: QuestionOptionInput[];
  starterCode?: string;
  incorrectCode?: string;
  expectedOutput?: string;
  sampleInput?: string;
  sampleOutput?: string;
  constraints?: string;
  shortAnswerKey?: string;
}

export type QuestionInitial = Partial<Record<keyof QuestionPayload, unknown>> & { options?: QuestionOptionInput[] };

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];
const OPTION_TYPES: QuestionType[] = ['MCQ', 'MULTIPLE_SELECT', 'TRUE_FALSE'];
const CODE_TYPES: QuestionType[] = ['CODING', 'CODE_COMPLETION', 'CODE_DEBUGGING', 'CODE_OUTPUT_PREDICTION'];
const TRUE_FALSE: QuestionOptionInput[] = [
  { text: 'True', isCorrect: false },
  { text: 'False', isCorrect: false },
];
const BLANK_OPTIONS: QuestionOptionInput[] = [
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
];

const str = (v: unknown, fallback = '') => (v == null ? fallback : String(v));

export function QuestionFormModal({
  open,
  onClose,
  title,
  subjects,
  fixedSubjectId,
  initial,
  submitLabel = 'Save Question',
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subjects?: { id: string; name: string }[];
  fixedSubjectId?: string;
  initial?: QuestionInitial;
  submitLabel?: string;
  onSubmit: (payload: QuestionPayload) => Promise<void>;
}) {
  const [type, setType] = useState<QuestionType>('MCQ');
  const [form, setForm] = useState({
    title: '', description: '', subjectId: '', topic: '', difficulty: 'MEDIUM', marks: '1', negativeMarks: '0',
    explanation: '', starterCode: '', incorrectCode: '', expectedOutput: '', sampleInput: '', sampleOutput: '',
    constraints: '', shortAnswerKey: '',
  });
  const [options, setOptions] = useState<QuestionOptionInput[]>(BLANK_OPTIONS);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset whenever the modal opens (fresh form, or the question being edited).
  useEffect(() => {
    if (!open) return;
    const i = initial ?? {};
    setType((i.type as QuestionType) ?? 'MCQ');
    setForm({
      title: str(i.title), description: str(i.description), subjectId: fixedSubjectId ?? str(i.subjectId),
      topic: str(i.topic), difficulty: str(i.difficulty, 'MEDIUM'), marks: str(i.marks, '1'),
      negativeMarks: str(i.negativeMarks, '0'), explanation: str(i.explanation), starterCode: str(i.starterCode),
      incorrectCode: str(i.incorrectCode), expectedOutput: str(i.expectedOutput), sampleInput: str(i.sampleInput),
      sampleOutput: str(i.sampleOutput), constraints: str(i.constraints), shortAnswerKey: str(i.shortAnswerKey),
    });
    setOptions(i.options?.length ? i.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) : BLANK_OPTIONS);
    setError('');
  }, [open, initial, fixedSubjectId]);

  const changeType = (next: QuestionType) => {
    setType(next);
    if (next === 'TRUE_FALSE') setOptions(TRUE_FALSE.map((o) => ({ ...o })));
    else if (OPTION_TYPES.includes(next) && options.length < 2) setOptions(BLANK_OPTIONS);
    else if (next === 'MCQ') {
      // single-answer: keep only the first correct option
      let seen = false;
      setOptions((prev) => prev.map((o) => (o.isCorrect && !seen ? ((seen = true), o) : { ...o, isCorrect: false })));
    }
  };

  const updateOption = (i: number, patch: Partial<QuestionOptionInput>) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        title: form.title || form.description.slice(0, 100),
        description: form.description,
        type,
        subjectId: form.subjectId,
        topic: form.topic || 'General',
        difficulty: form.difficulty,
        marks: Number(form.marks),
        negativeMarks: Number(form.negativeMarks),
        explanation: form.explanation || undefined,
        options: OPTION_TYPES.includes(type) ? options.filter((o) => o.text.trim()) : undefined,
        starterCode: form.starterCode || undefined,
        incorrectCode: form.incorrectCode || undefined,
        expectedOutput: form.expectedOutput || undefined,
        sampleInput: form.sampleInput || undefined,
        sampleOutput: form.sampleOutput || undefined,
        constraints: form.constraints || undefined,
        shortAnswerKey: form.shortAnswerKey || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Question Type</Label>
            <Select value={type} onChange={(e) => changeType(e.target.value as QuestionType)}>
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          {!fixedSubjectId && (
            <div>
              <Label>Subject</Label>
              <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">Select subject</option>
                {subjects?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div>
          <Label>Question</Label>
          <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <Label>Short title (optional)</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Defaults to the start of the question" />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label>Topic</Label>
            <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          </div>
          <div>
            <Label>Difficulty</Label>
            <Select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </Select>
          </div>
          <div>
            <Label>Marks</Label>
            <Input type="number" min="0" step="0.5" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
          </div>
          <div>
            <Label>Negative Marks</Label>
            <Input type="number" min="0" step="0.25" value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: e.target.value })} />
          </div>
        </div>

        {OPTION_TYPES.includes(type) && (
          <div>
            <Label>Options (mark the correct one{type === 'MULTIPLE_SELECT' ? 's' : ''})</Label>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type={type === 'MULTIPLE_SELECT' ? 'checkbox' : 'radio'}
                    name="correct-option"
                    checked={o.isCorrect}
                    onChange={(e) =>
                      type === 'MULTIPLE_SELECT'
                        ? updateOption(i, { isCorrect: e.target.checked })
                        : setOptions((prev) => prev.map((opt, idx) => ({ ...opt, isCorrect: idx === i })))
                    }
                  />
                  <Input
                    value={o.text}
                    readOnly={type === 'TRUE_FALSE'}
                    onChange={(e) => updateOption(i, { text: e.target.value })}
                    placeholder={`Option ${i + 1}`}
                  />
                  {type !== 'TRUE_FALSE' && options.length > 2 && (
                    <button className="text-xs text-muted hover:text-[var(--danger)]" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {type !== 'TRUE_FALSE' && (
                <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => setOptions([...options, { text: '', isCorrect: false }])}>
                  + Add option
                </button>
              )}
            </div>
          </div>
        )}

        {type === 'SHORT_ANSWER' && (
          <div>
            <Label>Expected Answer</Label>
            <Input value={form.shortAnswerKey} onChange={(e) => setForm({ ...form, shortAnswerKey: e.target.value })} />
          </div>
        )}

        {type === 'CODE_DEBUGGING' && (
          <div>
            <Label>Incorrect Code (for the student to fix)</Label>
            <Textarea rows={4} className="font-mono" value={form.incorrectCode} onChange={(e) => setForm({ ...form, incorrectCode: e.target.value })} />
          </div>
        )}

        {(type === 'CODING' || type === 'CODE_COMPLETION') && (
          <div>
            <Label>Starter Code</Label>
            <Textarea rows={4} className="font-mono" value={form.starterCode} onChange={(e) => setForm({ ...form, starterCode: e.target.value })} />
          </div>
        )}

        {type === 'CODE_OUTPUT_PREDICTION' && (
          <>
            <div>
              <Label>Code Snippet</Label>
              <Textarea rows={4} className="font-mono" value={form.starterCode} onChange={(e) => setForm({ ...form, starterCode: e.target.value })} />
            </div>
            <div>
              <Label>Expected Output</Label>
              <Input value={form.expectedOutput} onChange={(e) => setForm({ ...form, expectedOutput: e.target.value })} />
            </div>
          </>
        )}

        {CODE_TYPES.includes(type) && type !== 'CODE_OUTPUT_PREDICTION' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sample Input</Label>
              <Textarea rows={2} value={form.sampleInput} onChange={(e) => setForm({ ...form, sampleInput: e.target.value })} />
            </div>
            <div>
              <Label>Sample Output</Label>
              <Textarea rows={2} value={form.sampleOutput} onChange={(e) => setForm({ ...form, sampleOutput: e.target.value })} />
            </div>
          </div>
        )}

        <div>
          <Label>Explanation / model answer (optional)</Label>
          <Textarea rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
        </div>

        <Button className="w-full" loading={saving} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </Modal>
  );
}
