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
  _count: { attempts: number };
}

export default function ResultsIndexPage() {
  const [items, setItems] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Assessment[]>('/assessments')
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Results</h1>
        <p className="text-sm text-muted">Select an assessment to review, evaluate, and publish results.</p>
      </div>
      <Card>
        {loading && <LoadingBlock />}
        {!loading && items.length === 0 && <EmptyState title="No assessments yet" />}
        <div className="space-y-2">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/admin/results/${a.id}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3 hover:bg-slate-50"
            >
              <span>
                {a.title} <span className="text-xs text-muted">· {a.subject.name} · {a._count.attempts} attempts</span>
              </span>
              <Badge>{a.status}</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
