'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';
import { Badge, Card, ErrorBanner, LoadingBlock } from '@/components/ui/primitives';

interface ResultDetail {
  assessment: { title: string; totalMarks: number; passingMarks: number };
  obtainedMarks: number | null;
  percentage: number | null;
  passed: boolean | null;
  topicPerformance: { topic: string; percentage: number }[];
  answers:
    | {
        question: string;
        yourAnswer: unknown;
        correctAnswer: string[];
        explanation: string | null;
        marksAwarded: number;
        maxMarks: number;
      }[]
    | null;
}

export default function StudentResultDetailPage() {
  const params = useParams<{ attemptId: string }>();
  const [data, setData] = useState<ResultDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ResultDetail>(`/results/me/${params.attemptId}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.attemptId]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{data.assessment.title}</h1>
            <p className="text-sm text-muted">Passing marks: {data.assessment.passingMarks}</p>
          </div>
          <Badge tone={data.passed ? 'success' : 'danger'}>{data.passed ? 'Pass' : 'Fail'}</Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Obtained Marks" value={`${data.obtainedMarks ?? '—'} / ${data.assessment.totalMarks}`} />
          <Stat label="Percentage" value={`${data.percentage ?? '—'}%`} />
        </div>
      </Card>

      {data.topicPerformance.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Topic-wise Performance</h2>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={data.topicPerformance} layout="vertical" margin={{ left: 24 }}>
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis type="category" dataKey="topic" width={160} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="percentage" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {data.answers && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Answer Review</h2>
          <div className="space-y-4">
            {data.answers.map((a, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] p-4 text-sm">
                <p className="font-medium">{a.question}</p>
                <p className="mt-1 text-muted">Your answer: {JSON.stringify(a.yourAnswer)}</p>
                <p className="mt-1 text-[var(--success)]">Correct answer: {a.correctAnswer.join(', ')}</p>
                {a.explanation && <p className="mt-1 text-xs text-muted">{a.explanation}</p>}
                <p className="mt-2 text-xs font-medium">
                  Marks: {a.marksAwarded} / {a.maxMarks}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  );
}
