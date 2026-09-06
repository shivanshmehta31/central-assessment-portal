'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, ErrorBanner, LoadingBlock } from '@/components/ui/primitives';

interface AssessmentSummary {
  id: string;
  title: string;
  subject: string;
  totalStudents: number;
  completedEvaluations: number;
  pendingEvaluations: number;
}

export default function EvaluateIndexPage() {
  const [items, setItems] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<AssessmentSummary[]>('/evaluation/assessments')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Evaluate Submissions</h1>
        <p className="text-sm text-muted">Select an assessment to review student submissions.</p>
      </div>
      <Card>
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No assessments to evaluate" />}
        <div className="space-y-2">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/faculty/evaluate/${a.id}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 hover:bg-slate-50"
            >
              <span>
                {a.title} <span className="text-xs text-muted">· {a.subject} · {a.totalStudents} students</span>
              </span>
              <Badge tone={a.pendingEvaluations > 0 ? 'warning' : 'success'}>
                {a.completedEvaluations}/{a.totalStudents} evaluated
              </Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
