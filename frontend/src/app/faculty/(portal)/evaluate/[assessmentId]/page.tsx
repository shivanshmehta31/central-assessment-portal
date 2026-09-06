'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, ErrorBanner, LoadingBlock } from '@/components/ui/primitives';

interface Attempt {
  id: string;
  status: string;
  resultStatus: string;
  autoScore: number | null;
  manualScore: number | null;
  finalScore: number | null;
  submittedAt: string | null;
  student: { name: string; studentCode: string };
}

export default function EvaluateAssessmentPage() {
  const params = useParams<{ assessmentId: string }>();
  const [items, setItems] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Attempt[]>(`/evaluation/assessments/${params.assessmentId}/attempts`)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.assessmentId]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Student Submissions</h1>
      <Card>
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No submissions yet" />}
        {!loading && items.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
                <th className="py-2">Student</th>
                <th className="py-2">Submission Time</th>
                <th className="py-2">Objective Score</th>
                <th className="py-2">Manual Score</th>
                <th className="py-2">Total Score</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5">
                    <Link href={`/faculty/evaluate/${params.assessmentId}/${a.id}`} className="font-medium text-[var(--accent)] hover:underline">
                      {a.student.name}
                    </Link>
                    <p className="text-xs text-muted">{a.student.studentCode}</p>
                  </td>
                  <td className="py-2.5 text-xs text-muted">{a.submittedAt ? format(new Date(a.submittedAt), 'dd MMM, HH:mm') : '—'}</td>
                  <td className="py-2.5">{a.autoScore ?? '—'}</td>
                  <td className="py-2.5">{a.manualScore ?? '—'}</td>
                  <td className="py-2.5 font-medium">{a.finalScore ?? '—'}</td>
                  <td className="py-2.5">
                    <Badge tone={a.resultStatus === 'PENDING_EVALUATION' ? 'warning' : 'success'}>
                      {a.resultStatus.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
