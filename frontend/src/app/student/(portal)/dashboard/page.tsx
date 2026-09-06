'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Badge, Button, Card, EmptyState, ErrorBanner, LoadingBlock } from '@/components/ui/primitives';
import type { AvailableAssessment } from '@/lib/types';

const statusTone: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  Upcoming: 'info',
  Available: 'success',
  'In Progress': 'warning',
  Completed: 'neutral',
  Expired: 'danger',
  Unavailable: 'neutral',
};

export default function StudentDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<AvailableAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<AvailableAssessment[]>('/attempts/available')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAction = (item: AvailableAssessment) => {
    if (item.status === 'In Progress' && item.activeAttemptId) {
      router.push(`/student/exam/${item.activeAttemptId}`);
    } else if (item.status === 'Available') {
      router.push(`/student/assessment/${item.assessment.id}/instructions`);
    } else if (item.status === 'Completed') {
      router.push('/student/results');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome, {user?.name}</h1>
        <p className="text-sm text-muted">Here&apos;s what&apos;s on your schedule.</p>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">My Assessments</h2>
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && !error && items.length === 0 && (
          <EmptyState title="No assessments assigned yet" description="Check back once your institution schedules an assessment." />
        )}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.assessment.id}
              className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{item.assessment.title}</p>
                  <Badge tone={statusTone[item.status] ?? 'neutral'}>{item.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {item.assessment.subject} · {item.assessment.totalQuestions} questions · {item.assessment.durationMinutes} min ·{' '}
                  {item.assessment.totalMarks} marks
                </p>
                <p className="mt-1 text-xs text-muted">
                  Window: {format(new Date(item.assessment.startAt), 'dd MMM yyyy, HH:mm')} –{' '}
                  {format(new Date(item.assessment.endAt), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>
              <div>
                {(item.status === 'Available' || item.status === 'In Progress') && (
                  <Button onClick={() => handleAction(item)}>
                    {item.status === 'In Progress' ? 'Resume Exam' : 'Start Test'}
                  </Button>
                )}
                {item.status === 'Completed' && (
                  <Button variant="outline" onClick={() => handleAction(item)}>
                    View Result
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
