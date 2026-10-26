'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Card, EmptyState, ErrorBanner, Label, LoadingBlock, Modal, Select } from '@/components/ui/primitives';
import { QUESTION_TYPE_LABELS, type QuestionType } from '@/lib/types';
import { QuestionFormModal } from '@/components/questions/question-form-modal';

interface Subject {
  id: string;
  name: string;
}
interface Question {
  id: string;
  title: string;
  type: QuestionType;
  difficulty: string;
  topic: string;
  marks: number;
  subject: Subject;
}


export default function QuestionBankPage() {
  const [items, setItems] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ items: Question[] }>(`/questions?pageSize=100${subjectFilter ? `&subjectId=${subjectFilter}` : ''}`)
      .then((res) => setItems(res.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [subjectFilter]);

  useEffect(() => {
    load();
    api.get<Subject[]>('/subjects').then(setSubjects).catch(() => {});
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Question Bank</h1>
          <p className="text-sm text-muted">{items.length} questions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={15} /> Import CSV
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={15} /> Add Question
          </Button>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <Select className="max-w-xs" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No questions found" description="Add a question or import a CSV to get started." />}
        {!loading && items.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
                <th className="py-2">Title</th>
                <th className="py-2">Type</th>
                <th className="py-2">Topic</th>
                <th className="py-2">Difficulty</th>
                <th className="py-2">Marks</th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="max-w-xs truncate py-2.5 font-medium">{q.title}</td>
                  <td className="py-2.5">
                    <Badge tone="info">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                  </td>
                  <td className="py-2.5 text-muted">{q.topic}</td>
                  <td className="py-2.5 text-muted">{q.difficulty}</td>
                  <td className="py-2.5">{q.marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <QuestionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Question"
        subjects={subjects}
        onSubmit={async (payload) => {
          await api.post('/questions', payload);
          load();
        }}
      />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} subjects={subjects} onImported={load} />
    </div>
  );
}

function ImportModal({
  open,
  onClose,
  subjects,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  onImported: () => void;
}) {
  const [subjectId, setSubjectId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ total: number; succeeded: number; failed: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!file || !subjectId) return;
    setUploading(true);
    setError('');
    try {
      const res = await api.upload<{ total: number; succeeded: number; failed: number }>(
        '/questions/import/csv',
        file,
        'file',
        `?subjectId=${subjectId}`,
      );
      setResult(res);
      onImported();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import Questions (CSV)">
      <div className="space-y-3 text-sm">
        <p className="text-muted">
          Columns: question, questionType, optionA-D, correctAnswer (A/B/C/D), marks, topic, difficulty.
        </p>
        {error && <ErrorBanner message={error} />}
        {result ? (
          <div className="rounded-lg bg-slate-50 p-3">
            <p>Total rows: {result.total}</p>
            <p className="text-[var(--success)]">Succeeded: {result.succeeded}</p>
            <p className="text-[var(--danger)]">Failed: {result.failed}</p>
          </div>
        ) : (
          <>
            <div>
              <Label>Subject</Label>
              <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Select subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button className="flex-1" loading={uploading} disabled={!file || !subjectId} onClick={submit}>
              Upload &amp; Import
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
