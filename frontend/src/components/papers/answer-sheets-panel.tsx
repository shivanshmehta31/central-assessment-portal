'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Trash2, Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Card, EmptyState, ErrorBanner, LoadingBlock } from '@/components/ui/primitives';
import { StudentPicker, type PickableStudent } from './student-picker';
import { viewFile, type FileMeta } from '@/lib/papers';

interface SheetRow {
  attemptId: string;
  student: { id: string; name: string; studentCode: string; section: string | null };
  file: FileMeta | null;
  resultStatus: string;
  finalScore: number | null;
  manualScore: number | null;
}
interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  results: { filename: string; status: string; studentName?: string; studentCode?: string; error?: string }[];
}

const statusLabel: Record<string, { label: string; tone: 'warning' | 'success' | 'info' | 'neutral' }> = {
  PENDING_EVALUATION: { label: 'Pending evaluation', tone: 'warning' },
  EVALUATED: { label: 'Evaluated', tone: 'success' },
  PUBLISHED: { label: 'Published', tone: 'info' },
  WITHHELD: { label: 'Withheld', tone: 'neutral' },
};

export function AnswerSheetsPanel({ paperId, hasQuestions, onChanged }: { paperId: string; hasQuestions: boolean; onChanged?: () => void }) {
  const [data, setData] = useState<{ totalMarks: number; passingMarks: number; items: SheetRow[] } | null>(null);
  const [student, setStudent] = useState<PickableStudent | null>(null);
  const [single, setSingle] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const singleInput = useRef<HTMLInputElement>(null);
  const bulkInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api
      .get<{ totalMarks: number; passingMarks: number; items: SheetRow[] }>(`/question-papers/${paperId}/answer-sheets`)
      .then((d) => {
        setData(d);
        onChanged?.();
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  useEffect(load, [load]);

  const uploadSingle = async () => {
    if (!student || !single) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.append('studentId', student.id);
      form.append('file', single);
      const res = await api.form<{ studentName: string; replaced: boolean }>(`/question-papers/${paperId}/answer-sheets`, form);
      setMessage(`${res.replaced ? 'Replaced' : 'Uploaded'} answer sheet for ${res.studentName}.`);
      setStudent(null);
      setSingle(null);
      if (singleInput.current) singleInput.current.value = '';
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const uploadBulk = async (files: FileList | null) => {
    if (!files?.length) return;
    if (files.length > 25) {
      setError('Please upload at most 25 files at a time.');
      if (bulkInput.current) bulkInput.current.value = '';
      return;
    }
    setBulkUploading(true);
    setError('');
    setBulkResult(null);
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append('files', f));
      setBulkResult(await api.form<BulkResult>(`/question-papers/${paperId}/answer-sheets/bulk`, form));
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Upload failed');
    } finally {
      setBulkUploading(false);
      if (bulkInput.current) bulkInput.current.value = '';
    }
  };

  const remove = async (row: SheetRow) => {
    if (!confirm(`Delete ${row.student.name}'s answer sheet and any marks entered?`)) return;
    setError('');
    try {
      await api.delete(`/question-papers/${paperId}/answer-sheets/${row.attemptId}`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete');
    }
  };

  return (
    <div className="space-y-4">
      {message && <ErrorBanner message={message} tone="success" />}
      {error && <ErrorBanner message={error} />}
      {!hasQuestions && (
        <ErrorBanner tone="info" message="Add the paper's questions first (Questions tab) — you need them to mark each sheet." />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">Upload one answer sheet</h2>
          <StudentPicker value={student} onChange={setStudent} />
          <input ref={singleInput} type="file" accept=".pdf,.png,.jpg,.jpeg" className="block w-full text-sm" onChange={(e) => setSingle(e.target.files?.[0] ?? null)} />
          <Button loading={uploading} disabled={!student || !single} onClick={uploadSingle}>
            <Upload size={15} /> Upload sheet
          </Button>
          <p className="text-xs text-muted">PDF, PNG or JPG, up to 10 MB. Uploading again for the same student replaces the file.</p>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold">Bulk upload</h2>
          <p className="text-sm text-muted">
            Select up to 25 scans at once. Name each file after the Student ID — e.g. <code className="rounded bg-slate-100 px-1">CSE2026001.pdf</code> —
            and they&apos;re matched automatically.
          </p>
          <input ref={bulkInput} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => uploadBulk(e.target.files)} />
          <Button variant="outline" loading={bulkUploading} onClick={() => bulkInput.current?.click()}>
            <Upload size={15} /> Choose files
          </Button>
          {bulkResult && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              <p className="font-medium">
                {bulkResult.succeeded} of {bulkResult.total} uploaded{bulkResult.failed > 0 && `, ${bulkResult.failed} need attention`}
              </p>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {bulkResult.results.map((r) => (
                  <li key={r.filename} className={r.status === 'error' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}>
                    {r.filename} → {r.status === 'error' ? r.error : `${r.studentName} (${r.status})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Answer sheets ({data?.items.length ?? 0})</h2>
        {!data && <LoadingBlock />}
        {data && data.items.length === 0 && <EmptyState title="No answer sheets uploaded yet" />}
        {data && data.items.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
                <th className="py-2">Student</th>
                <th className="py-2">Sheet</th>
                <th className="py-2">Status</th>
                <th className="py-2">Score</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => {
                const status = statusLabel[r.resultStatus] ?? { label: r.resultStatus, tone: 'neutral' as const };
                return (
                  <tr key={r.attemptId} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5">
                      <p className="font-medium">{r.student.name}</p>
                      <p className="text-xs text-muted">{r.student.studentCode}</p>
                    </td>
                    <td className="py-2.5">
                      {r.file && (
                        <button className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline" onClick={() => viewFile(r.file!.id)}>
                          <FileText size={12} /> {r.file.filename}
                        </button>
                      )}
                    </td>
                    <td className="py-2.5">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td className="py-2.5">
                      {r.finalScore != null ? `${r.finalScore} / ${data.totalMarks}` : r.manualScore ? `${r.manualScore} (draft)` : '—'}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-3 text-xs">
                        <Link href={`/faculty/question-papers/${paperId}/evaluate/${r.attemptId}`} className="font-medium text-[var(--accent)] hover:underline">
                          {r.resultStatus === 'PENDING_EVALUATION' ? 'Evaluate' : 'Review'}
                        </Link>
                        {r.resultStatus !== 'PUBLISHED' && (
                          <button className="flex items-center gap-1 text-[var(--danger)] hover:underline" onClick={() => remove(r)}>
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
