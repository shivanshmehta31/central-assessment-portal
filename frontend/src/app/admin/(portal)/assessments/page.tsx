'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Label, LoadingBlock, Modal, Select } from '@/components/ui/primitives';

interface Subject {
  id: string;
  name: string;
}
interface Assessment {
  id: string;
  title: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string;
  totalMarks: number;
  subject: Subject;
  _count: { questions: number; assignments: number; attempts: number };
}

const statusTone: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  ACTIVE: 'success',
  PAUSED: 'warning',
  COMPLETED: 'neutral',
  ARCHIVED: 'neutral',
};

const ASSESSMENT_TYPES = ['QUIZ', 'INTERNAL_ASSESSMENT', 'PRACTICAL_ASSESSMENT', 'MID_TERM', 'FINAL_EXAM', 'MOCK_TEST', 'PRACTICE_TEST'];

export default function AssessmentsPage() {
  const [items, setItems] = useState<Assessment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Assessment[]>('/assessments')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api.get<Subject[]>('/subjects').then(setSubjects).catch(() => {});
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Assessments</h1>
          <p className="text-sm text-muted">{items.length} assessments</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={15} /> Create Assessment
        </Button>
      </div>

      <Card>
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No assessments yet" description="Create your first assessment to get started." />}
        <div className="space-y-3">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/admin/assessments/${a.id}`}
              className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.title}</p>
                  <Badge tone={statusTone[a.status]}>{a.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {a.subject?.name} · {a._count.questions} questions · {a._count.assignments} students assigned ·{' '}
                  {a._count.attempts} attempts
                </p>
                <p className="mt-1 text-xs text-muted">
                  {format(new Date(a.startAt), 'dd MMM yyyy, HH:mm')} – {format(new Date(a.endAt), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <CreateAssessmentModal open={modalOpen} onClose={() => setModalOpen(false)} subjects={subjects} onCreated={load} />
    </div>
  );
}

function CreateAssessmentModal({
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
  const [form, setForm] = useState({
    title: '',
    subjectId: '',
    type: 'INTERNAL_ASSESSMENT',
    totalMarks: '100',
    passingMarks: '40',
    durationMinutes: '60',
    startAt: '',
    endAt: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/assessments', {
        ...form,
        totalMarks: Number(form.totalMarks),
        passingMarks: Number(form.passingMarks),
        durationMinutes: Number(form.durationMinutes),
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Assessment" wide>
      <div className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <div>
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <Label>Assessment Type</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {ASSESSMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Total Marks</Label>
            <Input type="number" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} />
          </div>
          <div>
            <Label>Passing Marks</Label>
            <Input type="number" value={form.passingMarks} onChange={(e) => setForm({ ...form, passingMarks: e.target.value })} />
          </div>
          <div>
            <Label>Duration (minutes)</Label>
            <Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Date &amp; Time</Label>
            <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
          </div>
          <div>
            <Label>End Date &amp; Time</Label>
            <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
          </div>
        </div>
        <Button className="w-full" loading={saving} onClick={submit}>
          Create Assessment (Draft)
        </Button>
      </div>
    </Modal>
  );
}
