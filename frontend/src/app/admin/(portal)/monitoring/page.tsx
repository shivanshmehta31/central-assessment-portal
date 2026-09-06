'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, LoadingBlock } from '@/components/ui/primitives';

interface Assessment {
  id: string;
  title: string;
  status: string;
  subject: { name: string };
}

export default function MonitoringIndexPage() {
  const [items, setItems] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Assessment[]>('/assessments?status=ACTIVE')
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Live Exam Monitoring</h1>
        <p className="text-sm text-muted">Select an active assessment to view real-time student progress.</p>
      </div>
      <Card>
        {loading && <LoadingBlock />}
        {!loading && items.length === 0 && <EmptyState title="No assessments are currently active" />}
        <div className="space-y-2">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/admin/monitoring/${a.id}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 hover:bg-slate-50"
            >
              <span>
                {a.title} <span className="text-xs text-muted">· {a.subject.name}</span>
              </span>
              <Badge tone="success">{a.status}</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
