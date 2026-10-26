'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { format } from 'date-fns';
import { api, ApiError } from '@/lib/api';
import { Button, Card, ErrorBanner, Input, Label, LoadingBlock, Modal } from '@/components/ui/primitives';
import { QuestionsPanel } from '@/components/papers/questions-panel';
import { AnswerSheetsPanel } from '@/components/papers/answer-sheets-panel';
import type { PaperDetail } from '@/lib/papers';

type Tab = 'questions' | 'sheets';

export default function QuestionPaperDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [tab, setTab] = useState<Tab>('questions');
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(() => {
    api.get<PaperDetail>(`/question-papers/${params.id}`).then(setPaper).catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load'));
  }, [params.id]);

  useEffect(load, [load]);

  const remove = async () => {
    if (!confirm('Delete this question paper and its questions?')) return;
    try {
      await api.delete(`/question-papers/${params.id}`);
      router.replace('/faculty/question-papers');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete');
    }
  };

  if (error && !paper) return <ErrorBanner message={error} />;
  if (!paper) return <LoadingBlock />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{paper.title}</h1>
          <p className="text-sm text-muted">
            {paper.subject.name} · {format(new Date(paper.startAt), 'dd MMM yyyy')} · {paper.durationMinutes} min · {paper.totalMarks} marks · pass at{' '}
            {paper.passingMarks}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit details
          </Button>
          <Button variant="outline" onClick={remove}>
            Delete
          </Button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {([['questions', `Questions (${paper.questions.length})`], ['sheets', `Answer sheets (${paper._count.attempts})`]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={clsx('rounded-md px-4 py-1.5', tab === t ? 'bg-white font-medium shadow-sm' : 'text-muted')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'questions' ? (
        <QuestionsPanel paper={paper} onChanged={load} />
      ) : (
        <AnswerSheetsPanel paperId={paper.id} hasQuestions={paper.questions.length > 0} onChanged={load} />
      )}

      <EditDetailsModal paper={paper} open={editOpen} onClose={() => setEditOpen(false)} onSaved={load} />
    </div>
  );
}

function EditDetailsModal({ paper, open, onClose, onSaved }: { paper: PaperDetail; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: '', passingMarks: '', durationMinutes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ title: paper.title, passingMarks: String(paper.passingMarks), durationMinutes: String(paper.durationMinutes) });
  }, [open, paper]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/question-papers/${paper.id}`, {
        title: form.title,
        passingMarks: Number(form.passingMarks),
        durationMinutes: Number(form.durationMinutes),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit paper details">
      <Card className="space-y-3 border-0 p-0">
        {error && <ErrorBanner message={error} />}
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Passing marks</Label>
            <Input type="number" value={form.passingMarks} onChange={(e) => setForm({ ...form, passingMarks: e.target.value })} />
          </div>
          <div>
            <Label>Duration (minutes)</Label>
            <Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
          </div>
        </div>
        <Button className="w-full" loading={saving} onClick={save}>
          Save
        </Button>
      </Card>
    </Modal>
  );
}
