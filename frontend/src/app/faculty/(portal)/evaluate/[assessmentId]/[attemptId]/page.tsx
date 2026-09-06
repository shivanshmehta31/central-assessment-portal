'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Card, ErrorBanner, Input, LoadingBlock, Textarea } from '@/components/ui/primitives';

interface Answer {
  id: string;
  selectedOptionIds: string[];
  textAnswer: string | null;
  codeAnswer: string | null;
  isAnswered: boolean;
  isAutoEvaluated: boolean;
  autoScore: number | null;
  autoCorrect: boolean | null;
  manualScore: number | null;
  facultyFeedback: string | null;
  question: {
    id: string;
    title: string;
    description: string;
    type: string;
    marks: number;
    options: { id: string; text: string; isCorrect: boolean }[];
  };
}
interface AttemptDetail {
  id: string;
  resultStatus: string;
  student: { name: string; studentCode: string };
  assessment: { title: string; totalMarks: number };
  answers: Answer[];
}

export default function GradeAttemptPage() {
  const params = useParams<{ assessmentId: string; attemptId: string }>();
  const router = useRouter();
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [error, setError] = useState('');
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  const load = useCallback(() => {
    api
      .get<AttemptDetail>(`/evaluation/attempts/${params.attemptId}`)
      .then((data) => {
        setAttempt(data);
        const s: Record<string, string> = {};
        const f: Record<string, string> = {};
        data.answers.forEach((a) => {
          if (a.manualScore != null) s[a.id] = String(a.manualScore);
          if (a.facultyFeedback) f[a.id] = a.facultyFeedback;
        });
        setScores(s);
        setFeedback(f);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load'));
  }, [params.attemptId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveScore = async (answerId: string) => {
    setSavingId(answerId);
    try {
      await api.post(`/evaluation/answers/${answerId}/score`, {
        score: Number(scores[answerId] ?? 0),
        feedback: feedback[answerId] || undefined,
      });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save score');
    } finally {
      setSavingId('');
    }
  };

  const finalize = async () => {
    setFinalizing(true);
    setError('');
    try {
      await api.post(`/evaluation/attempts/${params.attemptId}/finalize`);
      router.push(`/faculty/evaluate/${params.assessmentId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to finalize');
    } finally {
      setFinalizing(false);
    }
  };

  if (error && !attempt) return <ErrorBanner message={error} />;
  if (!attempt) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{attempt.student.name}</h1>
          <p className="text-sm text-muted">
            {attempt.student.studentCode} · {attempt.assessment.title}
          </p>
        </div>
        <Button loading={finalizing} onClick={finalize} disabled={attempt.resultStatus !== 'PENDING_EVALUATION'}>
          {attempt.resultStatus === 'PENDING_EVALUATION' ? 'Finalize Evaluation' : 'Already Evaluated'}
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="space-y-4">
        {attempt.answers.map((a, i) => (
          <Card key={a.id}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">
                Q{i + 1}. {a.question.title}
              </p>
              <Badge tone="info">{a.question.marks} marks</Badge>
            </div>
            <p className="mb-3 whitespace-pre-wrap text-sm text-muted">{a.question.description}</p>

            {a.question.options.length > 0 ? (
              <div className="space-y-1 text-sm">
                <p>
                  <strong>Student answer:</strong>{' '}
                  {a.question.options.filter((o) => a.selectedOptionIds.includes(o.id)).map((o) => o.text).join(', ') || '—'}
                </p>
                <p className="text-[var(--success)]">
                  <strong>Correct answer:</strong> {a.question.options.filter((o) => o.isCorrect).map((o) => o.text).join(', ')}
                </p>
                <Badge tone={a.autoCorrect ? 'success' : 'danger'}>{a.autoCorrect ? 'Correct' : 'Incorrect'} · auto-scored {a.autoScore}</Badge>
              </div>
            ) : a.codeAnswer ? (
              <pre className="mb-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{a.codeAnswer}</pre>
            ) : (
              <p className="mb-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{a.textAnswer || 'No answer submitted.'}</p>
            )}

            {a.question.options.length === 0 && (
              <div className="flex items-end gap-3">
                <div className="w-32">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Score (max {a.question.marks})</label>
                  <Input
                    type="number"
                    max={a.question.marks}
                    value={scores[a.id] ?? ''}
                    onChange={(e) => setScores({ ...scores, [a.id]: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-700">Feedback</label>
                  <Textarea
                    rows={1}
                    value={feedback[a.id] ?? ''}
                    onChange={(e) => setFeedback({ ...feedback, [a.id]: e.target.value })}
                  />
                </div>
                <Button size="sm" loading={savingId === a.id} onClick={() => saveScore(a.id)}>
                  Save
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
