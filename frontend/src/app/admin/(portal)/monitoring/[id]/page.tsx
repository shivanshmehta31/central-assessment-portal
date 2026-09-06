'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Badge, Card, ErrorBanner, KpiCard, LoadingBlock } from '@/components/ui/primitives';

interface LiveStats {
  total: number;
  started: number;
  completed: number;
  active: number;
  flagged: number;
  terminated: number;
}
interface LiveStudent {
  attemptId: string;
  studentName: string;
  studentCode: string;
  currentQuestion: number;
  totalQuestions: number;
  remainingSeconds: number | null;
  violationCount: number;
  status: 'ACTIVE' | 'WARNING' | 'TERMINATED';
}

const statusIcon: Record<string, string> = { ACTIVE: '🟢', WARNING: '🟡', TERMINATED: '🔴' };

function formatMinSec(s: number | null) {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function MonitoringDetailPage() {
  const params = useParams<{ id: string }>();
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [students, setStudents] = useState<LiveStudent[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([
      api.get<LiveStats>(`/assessments/${params.id}/live-stats`),
      api.get<LiveStudent[]>(`/analytics/assessments/${params.id}/live`),
    ])
      .then(([s, st]) => {
        setStats(s);
        setStudents(st);
      })
      .catch((e) => setError(e.message));
  }, [params.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);

    const socket = getSocket();
    socket.emit('join:assessment-monitor', params.id);
    socket.on('assessment:live-stats', load);
    socket.on('violation:new', load);
    socket.on('attempt:update', load);

    return () => {
      clearInterval(interval);
      socket.off('assessment:live-stats', load);
      socket.off('violation:new', load);
      socket.off('attempt:update', load);
    };
  }, [params.id, load]);

  if (error) return <ErrorBanner message={error} />;
  if (!stats) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Live Exam Monitoring</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <KpiCard label="Total Students" value={stats.total} />
        <KpiCard label="Started" value={stats.started} />
        <KpiCard label="Currently Active" value={stats.active} tone="success" />
        <KpiCard label="Completed" value={stats.completed} />
        <KpiCard label="Flagged" value={stats.flagged} tone="warning" />
        <KpiCard label="Terminated" value={stats.terminated} tone="danger" />
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Students Currently Taking the Exam</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
              <th className="py-2">Student</th>
              <th className="py-2">Progress</th>
              <th className="py-2">Time Remaining</th>
              <th className="py-2">Violations</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.attemptId} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2.5">
                  <p className="font-medium">{s.studentName}</p>
                  <p className="text-xs text-muted">{s.studentCode}</p>
                </td>
                <td className="py-2.5">
                  {s.currentQuestion} / {s.totalQuestions}
                </td>
                <td className="py-2.5 tabular-nums">{formatMinSec(s.remainingSeconds)}</td>
                <td className="py-2.5">
                  {s.violationCount > 0 ? <Badge tone="warning">{s.violationCount}</Badge> : '—'}
                </td>
                <td className="py-2.5">
                  {statusIcon[s.status]} {s.status}
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">
                  No students are currently taking this examination.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
