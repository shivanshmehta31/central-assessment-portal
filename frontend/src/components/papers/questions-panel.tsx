'use client';

import { useRef, useState } from 'react';
import { Download, FileText, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { api, ApiError, saveBlob } from '@/lib/api';
import { Badge, Button, Card, EmptyState, ErrorBanner } from '@/components/ui/primitives';
import { QuestionFormModal, type QuestionInitial } from '@/components/questions/question-form-modal';
import { ImportReviewModal } from './import-review-modal';
import { QUESTION_TYPE_LABELS } from '@/lib/types';
import { formatBytes, viewFile, type FileMeta, type PaperDetail, type QuestionDraft } from '@/lib/papers';

export function QuestionsPanel({ paper, onChanged }: { paper: PaperDetail; onChanged: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [review, setReview] = useState<{ file: FileMeta; drafts: QuestionDraft[]; warnings: string[] } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; initial: QuestionInitial } | null>(null);
  const locked = paper._count.attempts > 0;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    setError('');
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.form<{ file: FileMeta; drafts: QuestionDraft[]; warnings: string[] }>(`/question-papers/${paper.id}/parse`, form);
      setReview(res);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Upload failed');
    } finally {
      setParsing(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const template = async (ext: 'csv' | 'xlsx') => {
    const blob = await api.blob(`/question-papers/templates/questions.${ext}`);
    saveBlob(blob, `question-paper-template.${ext}`);
  };

  const remove = async (questionId: string) => {
    if (!confirm('Remove this question from the paper?')) return;
    setError('');
    try {
      await api.delete(`/question-papers/${paper.id}/questions/${questionId}`);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not remove the question');
    }
  };

  return (
    <div className="space-y-4">
      {message && <ErrorBanner message={message} tone="success" />}
      {error && <ErrorBanner message={error} />}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">Upload question paper</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Upload an <strong>Excel</strong> or <strong>CSV</strong> file (one question per row) or a <strong>PDF</strong> (numbered questions are
              detected automatically). You&apos;ll review everything before it&apos;s added.
            </p>
            <div className="mt-2 flex gap-3 text-xs">
              <button className="flex items-center gap-1 text-[var(--accent)] hover:underline" onClick={() => template('xlsx')}>
                <Download size={12} /> Excel template
              </button>
              <button className="flex items-center gap-1 text-[var(--accent)] hover:underline" onClick={() => template('csv')}>
                <Download size={12} /> CSV template
              </button>
            </div>
          </div>
          <div>
            <input ref={fileInput} type="file" accept=".pdf,.csv,.xlsx" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button loading={parsing} onClick={() => fileInput.current?.click()}>
              <Upload size={15} /> Upload paper
            </Button>
          </div>
        </div>

        {paper.questionPaperFile && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <FileText size={15} className="text-muted" />
              {paper.questionPaperFile.filename}
              <span className="text-xs text-muted">{formatBytes(paper.questionPaperFile.size)}</span>
            </span>
            <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => viewFile(paper.questionPaperFile!.id)}>
              View original
            </button>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Questions ({paper.questions.length}) · {paper.totalMarks} marks total
          </h2>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> Add question
          </Button>
        </div>
        {paper.questions.length === 0 ? (
          <EmptyState title="No questions yet" description="Upload a paper above or add questions one by one." />
        ) : (
          <div className="space-y-2">
            {paper.questions.map(({ question: q }, i) => (
              <div key={q.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">Q{i + 1}</span>
                    <Badge tone="info">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                    <span className="text-muted">{q.marks} marks · {q.topic}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm">{q.description}</p>
                </div>
                <div className="flex shrink-0 gap-3 text-xs">
                  <button
                    className="flex items-center gap-1 text-[var(--accent)] hover:underline"
                    onClick={() =>
                      setEditing({
                        id: q.id,
                        initial: { ...q, options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
                      })
                    }
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button className="flex items-center gap-1 text-[var(--danger)] hover:underline" onClick={() => remove(q.id)}>
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {locked && <p className="mt-3 text-xs text-muted">Answer sheets exist for this paper — questions already scored can&apos;t be removed.</p>}
      </Card>

      <QuestionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add Question"
        fixedSubjectId={paper.subjectId}
        onSubmit={async (payload) => {
          await api.post(`/question-papers/${paper.id}/questions`, payload);
          onChanged();
        }}
      />
      <QuestionFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Question"
        submitLabel="Save changes"
        fixedSubjectId={paper.subjectId}
        initial={editing?.initial}
        onSubmit={async (payload) => {
          await api.patch(`/question-papers/${paper.id}/questions/${editing!.id}`, payload);
          onChanged();
        }}
      />
      <ImportReviewModal
        open={!!review}
        onClose={() => setReview(null)}
        paperId={paper.id}
        filename={review?.file.filename ?? ''}
        drafts={review?.drafts ?? []}
        warnings={review?.warnings ?? []}
        onImported={(n) => {
          setMessage(`Imported ${n} question${n === 1 ? '' : 's'}.`);
          onChanged();
        }}
      />
    </div>
  );
}
