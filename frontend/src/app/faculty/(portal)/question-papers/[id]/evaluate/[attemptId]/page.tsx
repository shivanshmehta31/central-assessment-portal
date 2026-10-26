'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Card, ErrorBanner, Input, LoadingBlock, Textarea } from '@/components/ui/primitives';
import { viewFile, type FileMeta } from '@/lib/papers';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/lib/types';

interface SheetQuestion {
  questionId: string;
  number: number;
  title: string;
  description: string;
  type: QuestionType;
  topic: string;
  marks: number;
  options: { text: string; isCorrect: boolean }[];
  shortAnswerKey: string | null;
  expectedOutput: string | null;
  explanation: string | null;
  score: number | null;
  feedback: string | null;
}
interface SheetDetail {
  attemptId: string;
  student: { name: string; studentCode: string };
  file: FileMeta | null;
  resultStatus: string;
  finalScore: number | null;
  totalMarks: number;
  passingMarks: number;
  nextPendingAttemptId: string | null;
  questions: SheetQuestion[];
}

// Renders the uploaded sheet from an authenticated blob (the API needs the auth header,
// so the file can't be pointed at directly by an <iframe>/<img>).
function SheetViewer({ file }: { file: FileMeta }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    api
      .blob(`/files/${file.id}`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id]);

  if (failed) return <p className="p-6 text-sm text-[var(--danger)]">Couldn&apos;t load the answer sheet.</p>;
  if (!url) return <LoadingBlock label="Loading answer sheet..." />;
  return file.mimeType === 'application/pdf' ? (
    <iframe src={url} title={file.filename} className="h-full w-full rounded-lg border border-[var(--border)] bg-white" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={file.filename} className="max-h-full w-full rounded-lg border border-[var(--border)] bg-white object-contain" />
  );
}

export default function EvaluateSheetPage() {
  const params = useParams<{ id: string; attemptId: string }>();
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState<'draft' | 'final' | null>(null);

  const load = useCallback(() => {
    setSheet(null);
    api
      .get<SheetDetail>(`/question-papers/${params.id}/answer-sheets/${params.attemptId}`)
      .then((d) => {
        setSheet(d);
        setScores(Object.fromEntries(d.questions.filter((q) => q.score != null).map((q) => [q.questionId, String(q.score)])));
        setFeedback(Object.fromEntries(d.questions.filter((q) => q.feedback).map((q) => [q.questionId, q.feedback!])));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load'));
  }, [params.id, params.attemptId]);

  useEffect(load, [load]);

  // Out-of-range entries are flagged and excluded, so the running total never overstates the marks.
  const isInvalid = (raw: string | undefined, max: number) => raw !== undefined && raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > max);
  const total = useMemo(
    () => (sheet ? sheet.questions.reduce((sum, q) => sum + (isInvalid(scores[q.questionId], q.marks) ? 0 : Number(scores[q.questionId]) || 0), 0) : 0),
    [scores, sheet],
  );
  const invalidCount = sheet ? sheet.questions.filter((q) => isInvalid(scores[q.questionId], q.marks)).length : 0;
  const readOnly = sheet?.resultStatus === 'PUBLISHED';
  const unscored = sheet ? sheet.questions.filter((q) => scores[q.questionId] === undefined || scores[q.questionId] === '').length : 0;

  const save = async (finalize: boolean) => {
    if (!sheet) return;
    setSaving(finalize ? 'final' : 'draft');
    setError('');
    setMessage('');
    try {
      const payload = sheet.questions
        .filter((q) => scores[q.questionId] !== undefined && scores[q.questionId] !== '')
        .map((q) => ({ questionId: q.questionId, score: Number(scores[q.questionId]), feedback: feedback[q.questionId] || undefined }));
      const res = await api.put<{ nextPendingAttemptId: string | null }>(`/question-papers/${params.id}/answer-sheets/${params.attemptId}/scores`, {
        scores: payload,
        finalize,
      });
      if (finalize) {
        router.push(res.nextPendingAttemptId ? `/faculty/question-papers/${params.id}/evaluate/${res.nextPendingAttemptId}` : `/faculty/question-papers/${params.id}`);
      } else {
        setMessage('Draft saved.');
        load();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const setAll = (mode: 'full' | 'zero') => {
    if (!sheet) return;
    setScores(Object.fromEntries(sheet.questions.map((q) => [q.questionId, mode === 'full' ? String(q.marks) : '0'])));
  };

  if (error && !sheet) return <ErrorBanner message={error} />;
  if (!sheet) return <LoadingBlock />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/faculty/question-papers/${params.id}`} className="flex items-center gap-1 text-xs text-muted hover:underline">
            <ArrowLeft size={12} /> Back to paper
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{sheet.student.name}</h1>
          <p className="text-sm text-muted">{sheet.student.studentCode}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={sheet.resultStatus === 'PENDING_EVALUATION' ? 'warning' : 'success'}>{sheet.resultStatus.replace(/_/g, ' ')}</Badge>
          <div className="rounded-lg bg-slate-100 px-4 py-2 text-lg font-semibold tabular-nums">
            {total} <span className="text-sm font-normal text-muted">/ {sheet.totalMarks}</span>
          </div>
        </div>
      </div>

      {message && <ErrorBanner message={message} tone="success" />}
      {error && <ErrorBanner message={error} />}
      {readOnly && <ErrorBanner tone="info" message="Results for this sheet are published, so marks are locked. An administrator can override a published score." />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-9rem)]">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>{sheet.file?.filename ?? 'No file'}</span>
            {sheet.file && (
              <button className="flex items-center gap-1 text-[var(--accent)] hover:underline" onClick={() => viewFile(sheet.file!.id)}>
                <ExternalLink size={12} /> Open in new tab
              </button>
            )}
          </div>
          <div className="h-[70vh] lg:h-[calc(100%-1.5rem)]">{sheet.file ? <SheetViewer file={sheet.file} /> : <p className="text-sm text-muted">No sheet uploaded.</p>}</div>
        </div>

        <div className="space-y-3">
          {!readOnly && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Quick fill</span>
              <span className="flex gap-3">
                <button className="text-[var(--accent)] hover:underline" onClick={() => setAll('full')}>
                  Full marks
                </button>
                <button className="text-[var(--accent)] hover:underline" onClick={() => setAll('zero')}>
                  All zero
                </button>
              </span>
            </div>
          )}

          {sheet.questions.map((q) => {
            const raw = scores[q.questionId] ?? '';
            const invalid = isInvalid(raw, q.marks);
            return (
              <Card key={q.questionId} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold">Q{q.number}</span>
                      <Badge tone="info">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                      <span className="text-muted">{q.topic}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{q.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Input
                        type="number"
                        min={0}
                        max={q.marks}
                        step="0.5"
                        disabled={readOnly}
                        className={invalid ? 'w-20 border-[var(--danger)] text-[var(--danger)]' : 'w-20'}
                        value={raw}
                        onChange={(e) => setScores({ ...scores, [q.questionId]: e.target.value })}
                      />
                      <span className="text-xs text-muted">/ {q.marks}</span>
                    </div>
                    {invalid && <p className="mt-1 text-[11px] text-[var(--danger)]">Enter 0 – {q.marks}</p>}
                    {!readOnly && (
                      <div className="mt-1 flex justify-end gap-2 text-[11px]">
                        <button className="text-[var(--accent)] hover:underline" onClick={() => setScores({ ...scores, [q.questionId]: String(q.marks) })}>
                          Full
                        </button>
                        <button className="text-[var(--accent)] hover:underline" onClick={() => setScores({ ...scores, [q.questionId]: '0' })}>
                          0
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {(q.options.some((o) => o.isCorrect) || q.shortAnswerKey || q.expectedOutput || q.explanation) && (
                  <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-muted">
                    <span className="font-medium text-slate-700">Answer key: </span>
                    {q.options.filter((o) => o.isCorrect).map((o) => o.text).join(', ') || q.shortAnswerKey || q.expectedOutput}
                    {q.explanation && <p className="mt-1">{q.explanation}</p>}
                  </div>
                )}

                <Textarea
                  rows={1}
                  disabled={readOnly}
                  placeholder="Feedback (optional)"
                  value={feedback[q.questionId] ?? ''}
                  onChange={(e) => setFeedback({ ...feedback, [q.questionId]: e.target.value })}
                />
              </Card>
            );
          })}

          {!readOnly && (
            <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white p-3 shadow-lg">
              <span className={invalidCount > 0 ? 'text-xs text-[var(--danger)]' : 'text-xs text-muted'}>
                {invalidCount > 0 ? `${invalidCount} score(s) out of range` : unscored > 0 ? `${unscored} question(s) not scored yet` : 'All questions scored'}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" loading={saving === 'draft'} disabled={invalidCount > 0} onClick={() => save(false)}>
                  Save draft
                </Button>
                <Button loading={saving === 'final'} disabled={unscored > 0 || invalidCount > 0} onClick={() => save(true)}>
                  {sheet.nextPendingAttemptId ? 'Finalize & next' : 'Finalize'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
