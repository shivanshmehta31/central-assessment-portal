'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/primitives';

export interface PickableStudent {
  id: string;
  name: string;
  studentCode: string;
  section?: string | null;
}

export function StudentPicker({ value, onChange }: { value: PickableStudent | null; onChange: (s: PickableStudent | null) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickableStudent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api.get<PickableStudent[]>(`/question-papers/students?search=${encodeURIComponent(query)}`).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm">
        <span>
          {value.name} <span className="text-xs text-muted">· {value.studentCode}</span>
        </span>
        <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder="Search student by name or ID..."
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--border)] bg-white shadow-lg">
          {results.map((s) => (
            <button
              key={s.id}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                onChange(s);
                setOpen(false);
                setQuery('');
              }}
            >
              <span>{s.name}</span>
              <span className="text-xs text-muted">{s.studentCode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
