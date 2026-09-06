'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, ErrorBanner, LoadingBlock } from '@/components/ui/primitives';

interface Violation {
  id: string;
  type: string;
  timestamp: string;
  actionTaken: string;
  overridden: boolean;
  student: { name: string; studentCode: string };
  attempt: { id: string; status: string; assessment: { title: string } };
}

export default function IncidentsPage() {
  const [items, setItems] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Violation[]>('/violations')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const override = async (id: string, action: 'IGNORE' | 'REMOVE' | 'RESET_COUNT') => {
    setBusyId(id);
    try {
      await api.post(`/violations/${id}/override`, { action });
      load();
    } finally {
      setBusyId('');
    }
  };

  const allowContinue = async (attemptId: string) => {
    setBusyId(attemptId);
    try {
      await api.post(`/attempts/${attemptId}/allow-continue`);
      load();
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Exam Incident Management</h1>
        <p className="text-sm text-muted">Review flagged violations and override where appropriate.</p>
      </div>

      <Card>
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No violations recorded" />}
        {!loading && items.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
                <th className="py-2">Student</th>
                <th className="py-2">Assessment</th>
                <th className="py-2">Violation</th>
                <th className="py-2">Time</th>
                <th className="py-2">Action Taken</th>
                <th className="py-2">Exam Status</th>
                <th className="py-2">Overrides</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5">
                    <p className="font-medium">{v.student.name}</p>
                    <p className="text-xs text-muted">{v.student.studentCode}</p>
                  </td>
                  <td className="py-2.5 text-muted">{v.attempt.assessment.title}</td>
                  <td className="py-2.5">{v.type.replace(/_/g, ' ')}</td>
                  <td className="py-2.5 text-xs text-muted">{format(new Date(v.timestamp), 'dd MMM, HH:mm:ss')}</td>
                  <td className="py-2.5">
                    <Badge tone={v.actionTaken === 'TERMINATED' ? 'danger' : v.actionTaken === 'AUTO_SUBMITTED' ? 'warning' : 'neutral'}>
                      {v.actionTaken}
                    </Badge>
                    {v.overridden && <span className="ml-1 text-xs text-muted">(overridden)</span>}
                  </td>
                  <td className="py-2.5 text-xs">{v.attempt.status}</td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        disabled={busyId === v.id}
                        className="text-[var(--accent)] hover:underline"
                        onClick={() => override(v.id, 'RESET_COUNT')}
                      >
                        Reset count
                      </button>
                      <button
                        disabled={busyId === v.id}
                        className="text-[var(--accent)] hover:underline"
                        onClick={() => override(v.id, 'IGNORE')}
                      >
                        Ignore
                      </button>
                      {(v.attempt.status === 'TERMINATED' || v.attempt.status === 'AUTO_SUBMITTED') && (
                        <button
                          disabled={busyId === v.attempt.id}
                          className="text-[var(--accent)] hover:underline"
                          onClick={() => allowContinue(v.attempt.id)}
                        >
                          Allow to continue
                        </button>
                      )}
                    </div>
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
