'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Card, EmptyState, ErrorBanner, KpiCard, LoadingBlock } from '@/components/ui/primitives';

interface AttemptRow {
  id: string;
  status: string;
  resultStatus: string;
  autoScore: number | null;
  manualScore: number | null;
  finalScore: number | null;
  submittedAt: string | null;
  student: { name: string; studentCode: string; section: string | null; batch: string | null };
}
interface Analytics {
  average: number | null;
  median: number | null;
  highest: number | null;
  lowest: number | null;
  passPercentage: number | null;
  failPercentage: number | null;
  attemptCount: number;
}
interface QuestionAnalytics {
  questionNumber: number;
  title: string;
  attempted: number;
  correct: number;
  incorrect: number;
  successPercentage: number | null;
}

export default function AdminResultDetailPage() {
  const params = useParams<{ id: string }>();
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [questionAnalytics, setQuestionAnalytics] = useState<QuestionAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [msgTone, setMsgTone] = useState<'success' | 'danger'>('success');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<AttemptRow[]>(`/results/assessments/${params.id}`),
      api.get<Analytics>(`/analytics/assessments/${params.id}`),
      api.get<QuestionAnalytics[]>(`/analytics/assessments/${params.id}/questions`),
    ])
      .then(([r, a, q]) => {
        setRows(r);
        setAnalytics(a);
        setQuestionAnalytics(q);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async () => {
    setMsg('');
    try {
      const res = await api.post<{ published: number }>(`/results/assessments/${params.id}/publish`);
      setMsgTone('success');
      setMsg(`Published results for ${res.published} student(s).`);
      load();
    } catch (e) {
      setMsgTone('danger');
      setMsg(e instanceof ApiError ? e.message : 'Failed to publish');
    }
  };

  const exportCsv = async () => {
    const csv = await api.get<string>(`/results/assessments/${params.id}/export.csv`);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `results-${params.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assessment Results</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </Button>
          <Button onClick={publish}>Publish Results</Button>
        </div>
      </div>

      {msg && <ErrorBanner message={msg} tone={msgTone} />}

      {analytics && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <KpiCard label="Average" value={analytics.average ?? '—'} />
          <KpiCard label="Median" value={analytics.median ?? '—'} />
          <KpiCard label="Highest" value={analytics.highest ?? '—'} tone="success" />
          <KpiCard label="Lowest" value={analytics.lowest ?? '—'} tone="danger" />
          <KpiCard label="Pass %" value={analytics.passPercentage != null ? `${analytics.passPercentage}%` : '—'} />
        </div>
      )}

      {questionAnalytics.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Question Analytics</h2>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={questionAnalytics}>
                <XAxis dataKey="questionNumber" tick={{ fontSize: 11 }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}%`} labelFormatter={(l) => `Question ${l}`} />
                <Bar dataKey="successPercentage" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Student Scores</h2>
        {rows.length === 0 && <EmptyState title="No submissions yet" />}
        {rows.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
                <th className="py-2">Student</th>
                <th className="py-2">Status</th>
                <th className="py-2">Auto Score</th>
                <th className="py-2">Manual Score</th>
                <th className="py-2">Final Score</th>
                <th className="py-2">Result Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5">
                    <p className="font-medium">{r.student.name}</p>
                    <p className="text-xs text-muted">{r.student.studentCode}</p>
                  </td>
                  <td className="py-2.5 text-xs">{r.status}</td>
                  <td className="py-2.5">{r.autoScore ?? '—'}</td>
                  <td className="py-2.5">{r.manualScore ?? '—'}</td>
                  <td className="py-2.5 font-medium">{r.finalScore ?? '—'}</td>
                  <td className="py-2.5">
                    <Badge tone={r.resultStatus === 'PUBLISHED' ? 'success' : r.resultStatus === 'PENDING_EVALUATION' ? 'warning' : 'neutral'}>
                      {r.resultStatus.replace(/_/g, ' ')}
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
