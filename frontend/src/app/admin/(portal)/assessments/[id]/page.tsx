'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Card, ErrorBanner, Input, Label, LoadingBlock, Select } from '@/components/ui/primitives';

interface Question {
  id: string;
  title: string;
  type: string;
  topic: string;
  marks: number;
}
interface AssessmentQuestion {
  question: Question;
}
interface Student {
  id: string;
  name: string;
  studentCode: string;
}
interface Faculty {
  id: string;
  name: string;
}
interface Assessment {
  id: string;
  title: string;
  status: string;
  subjectId: string;
  totalMarks: number;
  durationMinutes: number;
  startAt: string;
  endAt: string;
  violationLimit: number;
  violationAction: string;
  questions: AssessmentQuestion[];
  assignments: { student: Student }[];
  evaluators: { faculty: Faculty }[];
}

const statusTone: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  ACTIVE: 'success',
  PAUSED: 'warning',
  COMPLETED: 'neutral',
  ARCHIVED: 'neutral',
};

export default function AssessmentDetailPage() {
  const params = useParams<{ id: string }>();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(() => {
    api
      .get<Assessment>(`/assessments/${params.id}`)
      .then(setAssessment)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (action: () => Promise<unknown>, successMsg: string) => {
    setActionMsg('');
    setError('');
    try {
      await action();
      setActionMsg(successMsg);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    }
  };

  if (loading) return <LoadingBlock />;
  if (error && !assessment) return <ErrorBanner message={error} />;
  if (!assessment) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{assessment.title}</h1>
            <Badge tone={statusTone[assessment.status]}>{assessment.status}</Badge>
          </div>
          <p className="text-sm text-muted">
            {format(new Date(assessment.startAt), 'dd MMM yyyy, HH:mm')} – {format(new Date(assessment.endAt), 'dd MMM yyyy, HH:mm')} ·{' '}
            {assessment.durationMinutes} min · {assessment.totalMarks} marks
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/monitoring/${assessment.id}`}>
            <Button variant="outline">Live Monitoring</Button>
          </Link>
          <Link href={`/admin/results/${assessment.id}`}>
            <Button variant="outline">Results</Button>
          </Link>
        </div>
      </div>

      {actionMsg && <ErrorBanner message={actionMsg} tone="success" />}
      {error && <ErrorBanner message={error} />}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Exam Control</h2>
        <div className="flex flex-wrap gap-2">
          {assessment.status === 'DRAFT' && (
            <Button onClick={() => runAction(() => api.post(`/assessments/${assessment.id}/publish`), 'Assessment published (scheduled).')}>
              Publish
            </Button>
          )}
          {(assessment.status === 'SCHEDULED' || assessment.status === 'PAUSED') && (
            <Button onClick={() => runAction(() => api.post(`/assessments/${assessment.id}/start`), 'Assessment activated.')}>Start</Button>
          )}
          {assessment.status === 'ACTIVE' && (
            <Button variant="secondary" onClick={() => runAction(() => api.post(`/assessments/${assessment.id}/pause`), 'Assessment paused.')}>
              Pause
            </Button>
          )}
          {assessment.status !== 'COMPLETED' && assessment.status !== 'ARCHIVED' && (
            <Button variant="outline" onClick={() => runAction(() => api.post(`/assessments/${assessment.id}/end`), 'Assessment ended.')}>
              End Examination
            </Button>
          )}
          <ExtendTimeButton assessmentId={assessment.id} onDone={(msg) => runAction(async () => {}, msg)} />
          <Button
            variant="danger"
            onClick={() =>
              runAction(
                () => api.post(`/assessments/${assessment.id}/emergency-terminate`),
                'All in-progress attempts have been terminated.',
              )
            }
          >
            Emergency Terminate All
          </Button>
        </div>
      </Card>

      <QuestionAttachment assessment={assessment} onUpdated={load} />
      <StudentAssignment assessment={assessment} onUpdated={load} />
      <EvaluatorAssignment assessment={assessment} onUpdated={load} />
    </div>
  );
}

function ExtendTimeButton({ assessmentId, onDone }: { assessmentId: string; onDone: (msg: string) => void }) {
  const [minutes, setMinutes] = useState('10');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ affectedAttempts: number }>(`/assessments/${assessmentId}/extend-time`, { minutes: Number(minutes) });
      onDone(`Extended time by ${minutes} minutes for ${res.affectedAttempts} in-progress attempt(s).`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 py-1">
      <Input className="w-16 border-0 p-0 text-center" type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
      <span className="text-xs text-muted">min</span>
      <Button size="sm" variant="secondary" loading={busy} onClick={submit}>
        + Extend Time
      </Button>
    </div>
  );
}

function QuestionAttachment({ assessment, onUpdated }: { assessment: Assessment; onUpdated: () => void }) {
  const [bank, setBank] = useState<Question[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(assessment.questions.map((q) => q.question.id)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ items: Question[] }>(`/questions?subjectId=${assessment.subjectId}&pageSize=200`).then((res) => setBank(res.items));
  }, [assessment.subjectId]);

  useEffect(() => {
    setSelected(new Set(assessment.questions.map((q) => q.question.id)));
  }, [assessment.questions]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/assessments/${assessment.id}/questions`, { questionIds: [...selected] });
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const totalMarks = bank.filter((q) => selected.has(q.id)).reduce((sum, q) => sum + q.marks, 0);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Questions ({selected.size} selected · {totalMarks} marks)</h2>
        <Button size="sm" loading={saving} onClick={save}>
          Save Question Set
        </Button>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
        {bank.map((q) => (
          <label key={q.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} />
              {q.title}
            </span>
            <span className="text-xs text-muted">
              {q.topic} · {q.marks} marks
            </span>
          </label>
        ))}
        {bank.length === 0 && <p className="p-3 text-sm text-muted">No questions in the bank for this subject yet.</p>}
      </div>
    </Card>
  );
}

function StudentAssignment({ assessment, onUpdated }: { assessment: Assessment; onUpdated: () => void }) {
  const [departmentId, setDepartmentId] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [batch, setBatch] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<{ id: string; name: string }[]>('/departments').then(setDepartments);
  }, []);

  const assign = async () => {
    setSaving(true);
    setMsg('');
    try {
      const res = await api.post<{ assigned: number }>(`/assessments/${assessment.id}/assign-students`, {
        departmentId: departmentId || undefined,
        semester: semester || undefined,
        section: section || undefined,
        batch: batch || undefined,
      });
      setMsg(`${res.assigned} student(s) assigned.`);
      onUpdated();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Failed to assign students');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">Assigned Students ({assessment.assignments.length})</h2>
      {msg && <p className="mb-3 text-xs text-muted">{msg}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">Any department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Input placeholder="Semester" value={semester} onChange={(e) => setSemester(e.target.value)} />
        <Input placeholder="Section" value={section} onChange={(e) => setSection(e.target.value)} />
        <Input placeholder="Batch" value={batch} onChange={(e) => setBatch(e.target.value)} />
        <Button loading={saving} onClick={assign}>
          Assign Matching
        </Button>
      </div>
      <div className="mt-4 max-h-40 overflow-y-auto text-sm text-muted">
        {assessment.assignments.slice(0, 30).map((a) => (
          <span key={a.student.id} className="mr-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs">
            {a.student.name}
          </span>
        ))}
        {assessment.assignments.length > 30 && <span className="text-xs">+{assessment.assignments.length - 30} more</span>}
      </div>
    </Card>
  );
}

function EvaluatorAssignment({ assessment, onUpdated }: { assessment: Assessment; onUpdated: () => void }) {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(assessment.evaluators.map((e) => e.faculty.id)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Faculty[]>('/faculty').then(setFaculty);
  }, []);

  useEffect(() => {
    setSelected(new Set(assessment.evaluators.map((e) => e.faculty.id)));
  }, [assessment.evaluators]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/assessments/${assessment.id}/assign-evaluators`, { facultyIds: [...selected] });
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Evaluators</h2>
        <Button size="sm" loading={saving} onClick={save}>
          Save Evaluators
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        {faculty.map((f) => (
          <label key={f.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">
            <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
            {f.name}
          </label>
        ))}
      </div>
    </Card>
  );
}
