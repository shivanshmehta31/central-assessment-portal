'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, ErrorBanner, LoadingBlock } from '@/components/ui/primitives';

interface ResultRow {
  attemptId: string;
  assessmentTitle: string;
  subject: string;
  totalMarks: number;
  obtainedMarks: number | null;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
}

export default function StudentResultsPage() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<ResultRow[]>('/results/me')
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Results</h1>
      <Card>
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && rows.length === 0 && (
          <EmptyState title="No published results yet" description="Results appear here once your administrator publishes them." />
        )}
        <div className="space-y-3">
          {rows.map((r) => (
            <Link
              key={r.attemptId}
              href={`/student/results/${r.attemptId}`}
              className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{r.assessmentTitle}</p>
                <p className="text-sm text-muted">{r.subject}</p>
                {r.submittedAt && <p className="text-xs text-muted">Submitted {format(new Date(r.submittedAt), 'dd MMM yyyy, HH:mm')}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">
                  {r.obtainedMarks ?? '—'} / {r.totalMarks} ({r.percentage ?? '—'}%)
                </span>
                <Badge tone={r.passed ? 'success' : 'danger'}>{r.passed ? 'Pass' : 'Fail'}</Badge>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
