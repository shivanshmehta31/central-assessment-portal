'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, ErrorBanner, Input, Modal, Select, Textarea } from '@/components/ui/primitives';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/lib/types';
import { OPTION_TYPES, validateDraft, type QuestionDraft } from '@/lib/papers';

interface Row extends QuestionDraft {
  include: boolean;
}

const TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];

export function ImportReviewModal({
  open,
  onClose,
  paperId,
  filename,
  drafts,
  warnings,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  paperId: string;
  filename: string;
  drafts: QuestionDraft[];
  warnings: string[];
  onImported: (count: number) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setRows(drafts.map((d) => ({ ...d, include: true })));
      setExpanded(null);
      setError('');
    }
  }, [open, drafts]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        return { ...next, errors: validateDraft(next) };
      }),
    );

  const included = rows.filter((r) => r.include);
  const blocking = included.filter((r) => r.errors.length > 0).length;
  const totalMarks = useMemo(() => included.reduce((s, r) => s + (Number(r.marks) || 0), 0), [included]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = included.map(({ include, errors, rowNumber, ...d }) => ({
        ...d,
        options: OPTION_TYPES.includes(d.type) ? d.options.filter((o) => o.text.trim()) : undefined,
      }));
      const res = await api.post<{ imported: number }>(`/question-papers/${paperId}/questions/bulk`, { drafts: payload });
      onImported(res.imported);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Import failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Review questions from ${filename}`} wide>
      <div className="space-y-3">
        {warnings.map((w) => (
          <ErrorBanner key={w} message={w} tone="info" />
        ))}
        {error && <ErrorBanner message={error} />}

        {rows.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-muted">
            No questions were detected. The file is saved as this paper&apos;s reference document — add the questions manually.
          </p>
        ) : (
          <>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {rows.map((r, i) => (
                <div key={i} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium">Question {i + 1}</span>
                        <Badge tone="info">{QUESTION_TYPE_LABELS[r.type]}</Badge>
                        <span className="text-muted">{r.marks} marks</span>
                        {r.errors.length > 0 && <Badge tone="danger">{r.errors.length} to fix</Badge>}
                      </div>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm">{r.description || <em className="text-muted">(empty)</em>}</p>
                      {r.errors.length > 0 && <p className="mt-1 text-xs text-[var(--danger)]">{r.errors.join(' · ')}</p>}
                    </div>
                    <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => setExpanded(expanded === i ? null : i)}>
                      {expanded === i ? 'Close' : 'Edit'}
                    </button>
                  </div>

                  {expanded === i && (
                    <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
                      <Textarea rows={3} value={r.description} onChange={(e) => update(i, { description: e.target.value, title: e.target.value.replace(/\s+/g, ' ').slice(0, 100) })} />
                      <div className="grid grid-cols-3 gap-3">
                        <Select
                          value={r.type}
                          onChange={(e) => {
                            const type = e.target.value as QuestionType;
                            const options =
                              type === 'TRUE_FALSE'
                                ? [{ text: 'True', isCorrect: false }, { text: 'False', isCorrect: false }]
                                : OPTION_TYPES.includes(type) && r.options.length < 2
                                  ? [{ text: '', isCorrect: false }, { text: '', isCorrect: false }]
                                  : r.options;
                            update(i, { type, options });
                          }}
                        >
                          {TYPES.map((t) => (
                            <option key={t} value={t}>
                              {QUESTION_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </Select>
                        <Input type="number" min="0" step="0.5" value={r.marks} onChange={(e) => update(i, { marks: Number(e.target.value) })} />
                        <Input value={r.topic} onChange={(e) => update(i, { topic: e.target.value })} placeholder="Topic" />
                      </div>
                      {OPTION_TYPES.includes(r.type) && (
                        <div className="space-y-2">
                          {r.options.map((o, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                type={r.type === 'MULTIPLE_SELECT' ? 'checkbox' : 'radio'}
                                name={`correct-${i}`}
                                checked={o.isCorrect}
                                onChange={(e) =>
                                  update(i, {
                                    options: r.options.map((opt, idx) =>
                                      r.type === 'MULTIPLE_SELECT'
                                        ? idx === oi ? { ...opt, isCorrect: e.target.checked } : opt
                                        : { ...opt, isCorrect: idx === oi },
                                    ),
                                  })
                                }
                              />
                              <Input
                                value={o.text}
                                readOnly={r.type === 'TRUE_FALSE'}
                                onChange={(e) => update(i, { options: r.options.map((opt, idx) => (idx === oi ? { ...opt, text: e.target.value } : opt)) })}
                              />
                            </div>
                          ))}
                          {r.type !== 'TRUE_FALSE' && (
                            <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => update(i, { options: [...r.options, { text: '', isCorrect: false }] })}>
                              + Add option
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">
                {included.length} of {rows.length} selected · {totalMarks} marks
                {blocking > 0 && <span className="text-[var(--danger)]"> · fix or deselect {blocking} question(s) to continue</span>}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button loading={saving} disabled={!included.length || blocking > 0} onClick={submit}>
                  Import {included.length} question{included.length === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          </>
        )}
        {rows.length === 0 && (
          <Button className="w-full" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </Modal>
  );
}
