'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Label, LoadingBlock, Modal, Select } from '@/components/ui/primitives';
import type { PaperSummary } from '@/lib/papers';

interface Subject {
  id: string;
  name: string;
}

const ASSESSMENT_TYPES = ['QUIZ', 'INTERNAL_ASSESSMENT', 'PRACTICAL_ASSESSMENT', 'MID_TERM', 'FINAL_EXAM', 'MOCK_TEST', 'PRACTICE_TEST'];

export default function QuestionPapersPage() {
  const [items, setItems] = useState<PaperSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api
      .get<PaperSummary[]>('/question-papers')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Question Papers</h1>
          <p className="text-sm text-muted">Paper-based assessments: upload or write the paper, upload answer sheets, and evaluate them.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={15} /> New question paper
        </Button>
      </div>

      <Card>
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No question papers yet" description="Create one to upload a paper and start evaluating answer sheets." />}
        <div className="space-y-3">
          {items.map((p) => (
            <Link
              key={p.id}
              href={`/faculty/question-papers/${p.id}`}
              className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-sm text-muted">
                  {p.subject.name} · {p._count.questions} questions · {p.totalMarks} marks · {format(new Date(p.startAt), 'dd MMM yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{p.sheetCount} sheets</Badge>
                {p.pendingCount > 0 ? <Badge tone="warning">{p.pendingCount} to evaluate</Badge> : p.sheetCount > 0 && <Badge tone="success">All evaluated</Badge>}
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <CreatePaperModal open={open} onClose={() => setOpen(false)} onCreated={load} />
    </div>
  );
}

function CreatePaperModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState({ title: '', subjectId: '', type: 'INTERNAL_ASSESSMENT', examDate: '', durationMinutes: '180', passingMarks: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) api.get<Subject[]>('/question-papers/subjects').then(setSubjects).catch(() => {});
  }, [open]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/question-papers', {
        title: form.title,
        subjectId: form.subjectId,
        type: form.type,
        durationMinutes: Number(form.durationMinutes) || undefined,
        passingMarks: form.passingMarks ? Number(form.passingMarks) : undefined,
        examDate: form.examDate ? new Date(form.examDate).toISOString() : undefined,
      });
      onCreated();
      onClose();
      setForm({ ...form, title: '' });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create paper');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New question paper">
      <div className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mid-Term Examination — Unit 1–3" />
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
          {subjects.length === 0 && <p className="mt-1 text-xs text-muted">You have no subjects assigned yet — ask an administrator to assign one.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {ASSESSMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Exam date</Label>
            <Input type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
          </div>
          <div>
            <Label>Duration (minutes)</Label>
            <Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
          </div>
          <div>
            <Label>Passing marks</Label>
            <Input type="number" value={form.passingMarks} onChange={(e) => setForm({ ...form, passingMarks: e.target.value })} placeholder="Optional" />
          </div>
        </div>
        <Button className="w-full" loading={saving} disabled={!form.title || !form.subjectId} onClick={submit}>
          Create paper
        </Button>
      </div>
    </Modal>
  );
}
