'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Badge, Card, EmptyState, ErrorBanner, LoadingBlock } from '@/components/ui/primitives';
import type { PaperSummary } from '@/lib/papers';

interface AssessmentSummary {
  id: string;
  title: string;
  subject: string;
  totalStudents: number;
  completedEvaluations: number;
  pendingEvaluations: number;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
}

export default function FacultyDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<AssessmentSummary[]>([]);
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<PaperSummary[]>('/question-papers').then(setPapers).catch(() => {});
    api
      .get<AssessmentSummary[]>('/evaluation/assessments')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome, {user?.name}</h1>
        <p className="text-sm text-muted">Assessments assigned to you for evaluation.</p>
      </div>

      <Card>
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No assessments assigned yet" />}
        <div className="space-y-3">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/faculty/evaluate/${a.id}`}
              className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted">{a.subject}</p>
                <p className="mt-1 text-xs text-muted">
                  {a.totalStudents} students · avg {a.averageScore?.toFixed(1) ?? '—'} · high {a.highestScore ?? '—'} · low{' '}
                  {a.lowestScore ?? '—'}
                </p>
              </div>
              <Badge tone={a.pendingEvaluations > 0 ? 'warning' : 'success'}>
                {a.pendingEvaluations > 0 ? `${a.pendingEvaluations} pending` : 'All evaluated'}
              </Badge>
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Paper-based question papers</h2>
          <Link href="/faculty/question-papers" className="text-xs text-[var(--accent)] hover:underline">
            Manage all
          </Link>
        </div>
        {papers.length === 0 ? (
          <EmptyState title="No question papers yet" description="Upload a paper and its answer sheets from Question Papers." />
        ) : (
          <div className="space-y-2">
            {papers.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                href={`/faculty/question-papers/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 text-sm hover:bg-slate-50"
              >
                <span>
                  {p.title} <span className="text-xs text-muted">· {p.subject.name}</span>
                </span>
                <Badge tone={p.pendingCount > 0 ? 'warning' : 'neutral'}>
                  {p.pendingCount > 0 ? `${p.pendingCount} to evaluate` : `${p.sheetCount} sheets`}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
