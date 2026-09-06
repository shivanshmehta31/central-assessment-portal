'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { Card, ErrorBanner, KpiCard, LoadingBlock } from '@/components/ui/primitives';

interface Overview {
  totalStudents: number;
  activeStudents: number;
  totalFaculty: number;
  totalAssessments: number;
  upcomingAssessments: number;
  activeAssessments: number;
  completedAssessments: number;
  studentsInProgress: number;
  studentsCompleted: number;
  notStarted: number;
  flagged: number;
  terminated: number;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
}

const COLORS = ['#1e3a8a', '#2563eb', '#93c5fd', '#e2e8f0'];

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Overview>('/analytics/overview')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <LoadingBlock />;

  const examStatusData = [
    { name: 'Completed', value: data.studentsCompleted },
    { name: 'In Progress', value: data.studentsInProgress },
    { name: 'Not Started', value: data.notStarted },
  ];

  const assessmentStatusData = [
    { name: 'Upcoming', count: data.upcomingAssessments },
    { name: 'Active', count: data.activeAssessments },
    { name: 'Completed', count: data.completedAssessments },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Admin Control Center</h1>
        <p className="text-sm text-muted">Institution-wide overview and system health.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Total Students" value={data.totalStudents} sub={`${data.activeStudents} active`} />
        <KpiCard label="Total Faculty" value={data.totalFaculty} />
        <KpiCard label="Total Assessments" value={data.totalAssessments} />
        <KpiCard label="Active Now" value={data.activeAssessments} tone="success" />
        <KpiCard label="Students In Progress" value={data.studentsInProgress} tone="warning" />
        <KpiCard label="Flagged (Violations)" value={data.flagged} tone="warning" />
        <KpiCard label="Terminated" value={data.terminated} tone="danger" />
        <KpiCard label="Average Score" value={data.averageScore != null ? data.averageScore.toFixed(1) : '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Exam Progress (All Assessments)</h2>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={examStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {examStatusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex justify-center gap-4 text-xs">
            {examStatusData.map((d, i) => (
              <span key={d.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i] }} />
                {d.name}: {d.value}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Assessments by Status</h2>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={assessmentStatusData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiCard label="Highest Score" value={data.highestScore ?? '—'} tone="success" />
        <KpiCard label="Lowest Score" value={data.lowestScore ?? '—'} tone="danger" />
        <KpiCard label="Completed Assessments" value={data.completedAssessments} />
      </div>
    </div>
  );
}
