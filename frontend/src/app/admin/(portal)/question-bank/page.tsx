'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Label, LoadingBlock, Modal, Select, Textarea } from '@/components/ui/primitives';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/lib/types';

interface Subject {
  id: string;
  name: string;
}
interface Option {
  text: string;
  isCorrect: boolean;
}
interface Question {
  id: string;
  title: string;
  type: QuestionType;
  difficulty: string;
  topic: string;
  marks: number;
  subject: Subject;
}

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];
const OPTION_TYPES: QuestionType[] = ['MCQ', 'MULTIPLE_SELECT', 'TRUE_FALSE'];
const CODE_TYPES: QuestionType[] = ['CODING', 'CODE_COMPLETION', 'CODE_DEBUGGING', 'CODE_OUTPUT_PREDICTION'];

export default function QuestionBankPage() {
  const [items, setItems] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ items: Question[] }>(`/questions?pageSize=100${subjectFilter ? `&subjectId=${subjectFilter}` : ''}`)
      .then((res) => setItems(res.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [subjectFilter]);

  useEffect(() => {
    load();
    api.get<Subject[]>('/subjects').then(setSubjects).catch(() => {});
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Question Bank</h1>
          <p className="text-sm text-muted">{items.length} questions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={15} /> Import CSV
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={15} /> Add Question
          </Button>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <Select className="max-w-xs" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No questions found" description="Add a question or import a CSV to get started." />}
        {!loading && items.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
                <th className="py-2">Title</th>
                <th className="py-2">Type</th>
                <th className="py-2">Topic</th>
                <th className="py-2">Difficulty</th>
                <th className="py-2">Marks</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="max-w-xs truncate py-2.5 font-medium">{q.title}</td>
                  <td className="py-2.5">
                    <Badge tone="info">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                  </td>
                  <td className="py-2.5 text-muted">{q.topic}</td>
                  <td className="py-2.5 text-muted">{q.difficulty}</td>
                  <td className="py-2.5">{q.marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <QuestionModal open={modalOpen} onClose={() => setModalOpen(false)} subjects={subjects} onCreated={load} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} subjects={subjects} onImported={load} />
    </div>
  );
}

function QuestionModal({
  open,
  onClose,
  subjects,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  onCreated: () => void;
}) {
  const [type, setType] = useState<QuestionType>('MCQ');
  const [form, setForm] = useState({
    title: '',
    description: '',
    subjectId: '',
    topic: '',
    difficulty: 'MEDIUM',
    marks: '1',
    negativeMarks: '0',
    explanation: '',
    starterCode: '',
    incorrectCode: '',
    expectedOutput: '',
    sampleInput: '',
    sampleOutput: '',
    constraints: '',
    shortAnswerKey: '',
  });
  const [options, setOptions] = useState<Option[]>([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateOption = (i: number, patch: Partial<Option>) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/questions', {
        title: form.title,
        description: form.description,
        type,
        subjectId: form.subjectId,
        topic: form.topic,
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
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create question');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Question" wide>
      <div className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Question Type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <Label>Question Description</Label>
          <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
            <Input type="number" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
          </div>
          <div>
            <Label>Negative Marks</Label>
            <Input type="number" value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: e.target.value })} />
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
                  <Input value={o.text} onChange={(e) => updateOption(i, { text: e.target.value })} placeholder={`Option ${i + 1}`} />
                </div>
              ))}
              <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => setOptions([...options, { text: '', isCorrect: false }])}>
                + Add option
              </button>
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
          <Label>Explanation (shown after evaluation, optional)</Label>
          <Textarea rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
        </div>

        <Button className="w-full" loading={saving} onClick={submit}>
          Save Question
        </Button>
      </div>
    </Modal>
  );
}

function ImportModal({
  open,
  onClose,
  subjects,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  onImported: () => void;
}) {
  const [subjectId, setSubjectId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ total: number; succeeded: number; failed: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!file || !subjectId) return;
    setUploading(true);
    setError('');
    try {
      const res = await api.upload<{ total: number; succeeded: number; failed: number }>(
        '/questions/import/csv',
        file,
        'file',
        `?subjectId=${subjectId}`,
      );
      setResult(res);
      onImported();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import Questions (CSV)">
      <div className="space-y-3 text-sm">
        <p className="text-muted">
          Columns: question, questionType, optionA-D, correctAnswer (A/B/C/D), marks, topic, difficulty.
        </p>
        {error && <ErrorBanner message={error} />}
        {result ? (
          <div className="rounded-lg bg-slate-50 p-3">
            <p>Total rows: {result.total}</p>
            <p className="text-[var(--success)]">Succeeded: {result.succeeded}</p>
            <p className="text-[var(--danger)]">Failed: {result.failed}</p>
          </div>
        ) : (
          <>
            <div>
              <Label>Subject</Label>
              <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button className="flex-1" loading={uploading} disabled={!file || !subjectId} onClick={submit}>
              Upload &amp; Import
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
