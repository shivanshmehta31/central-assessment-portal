'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { Card, EmptyState, ErrorBanner, Input, LoadingBlock } from '@/components/ui/primitives';

interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  timestamp: string;
  user: { email: string; role: string } | null;
}

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ items: AuditLog[]; total: number }>(`/audit-logs?pageSize=50${search ? `&action=${encodeURIComponent(search)}` : ''}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted">{total} recorded actions</p>
      </div>

      <Card>
        <Input placeholder="Filter by action (e.g. EXAM_SUBMITTED)" className="mb-4 max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No audit entries" />}
        {!loading && items.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
                <th className="py-2">Timestamp</th>
                <th className="py-2">User</th>
                <th className="py-2">Action</th>
                <th className="py-2">Entity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => (
                <tr key={log.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5 text-xs text-muted">{format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm:ss')}</td>
                  <td className="py-2.5 text-xs">{log.user?.email ?? 'System'}</td>
                  <td className="py-2.5 font-mono text-xs">{log.action}</td>
                  <td className="py-2.5 text-xs text-muted">
                    {log.entityType} {log.entityId ? `· ${log.entityId.slice(0, 10)}...` : ''}
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
