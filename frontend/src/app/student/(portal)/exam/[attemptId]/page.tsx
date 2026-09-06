'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { AlertTriangle, Check, Clock, Flag, WifiOff } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useIntegrityMonitor } from '@/hooks/use-integrity-monitor';
import { Button, LoadingBlock, Modal } from '@/components/ui/primitives';
import { QuestionRenderer, type LocalAnswer } from '@/components/exam/question-renderer';
import type { AttemptState } from '@/lib/types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline';

function emptyAnswer(): LocalAnswer {
  return { selectedOptionIds: [], textAnswer: '', codeAnswer: '' };
}

function formatTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function ExamPage() {
  const params = useParams<{ attemptId: string }>();
  const router = useRouter();
  const attemptId = params.attemptId;

  const [state, setState] = useState<AttemptState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isOnline, setIsOnline] = useState(true);
  const [violationCount, setViolationCount] = useState(0);
  const [warningOpen, setWarningOpen] = useState(false);
  const [lastViolationMessage, setLastViolationMessage] = useState('');
  const [finalScreen, setFinalScreen] = useState<null | { reason: string }>(null);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingQueue = useRef<Set<string>>(new Set());

  // ── Load attempt state ────────────────────────────────────────────────
  useEffect(() => {
    api
      .get<AttemptState>(`/attempts/${attemptId}`)
      .then((data) => {
        if (data.status !== 'IN_PROGRESS') {
          setFinalScreen({ reason: data.status });
          return;
        }
        setState(data);
        setCurrentIndex(data.currentQuestionIndex ?? 0);
        setRemainingSeconds(data.remainingSeconds ?? 0);
        setViolationCount(data.violationCount ?? 0);
        const initialAnswers: Record<string, LocalAnswer> = {};
        const initialMarked: Record<string, boolean> = {};
        data.questions.forEach((q) => {
          initialAnswers[q.questionId] = {
            selectedOptionIds: q.answer?.selectedOptionIds ?? [],
            textAnswer: q.answer?.textAnswer ?? '',
            codeAnswer: q.answer?.codeAnswer ?? '',
          };
          initialMarked[q.questionId] = q.answer?.isMarkedForReview ?? false;
        });
        setAnswers(initialAnswers);
        setMarkedForReview(initialMarked);
      })
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Unable to load examination'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // ── Countdown timer (client display only — server enforces the real deadline) ──
  useEffect(() => {
    if (!state || finalScreen) return;
    const interval = setInterval(() => {
      setRemainingSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          handleAutoTimeUp();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, finalScreen]);

  const handleAutoTimeUp = useCallback(async () => {
    try {
      const result = await api.get<AttemptState | { status: string }>(`/attempts/${attemptId}`);
      setFinalScreen({ reason: (result as any).status ?? 'AUTO_SUBMITTED' });
    } catch {
      setFinalScreen({ reason: 'TIME_EXPIRED' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // ── Online/offline detection ──────────────────────────────────────────
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Realtime: admin-triggered force submit / time extension ──────────
  useEffect(() => {
    if (!state) return;
    const socket = getSocket();
    socket.emit('join:attempt', attemptId);
    const onForceSubmit = (payload: { attemptId: string; reason: string }) => {
      if (payload.attemptId === attemptId) setFinalScreen({ reason: payload.reason });
    };
    const onTimeExtended = (payload: { attemptId: string; minutes: number }) => {
      if (payload.attemptId === attemptId) setRemainingSeconds((s) => s + payload.minutes * 60);
    };
    socket.on('attempt:force-submit', onForceSubmit);
    socket.on('attempt:time-extended', onTimeExtended);
    return () => {
      socket.off('attempt:force-submit', onForceSubmit);
      socket.off('attempt:time-extended', onTimeExtended);
    };
  }, [attemptId, state]);

  // ── Integrity monitoring ───────────────────────────────────────────────
  const reportViolation = useCallback(
    async (type: string) => {
      if (!state || finalScreen) return;
      try {
        const res = await api.post<{ violationCount: number; actionTaken: string; examTerminated: boolean }>(
          `/attempts/${attemptId}/violations`,
          { type, questionIndexAtTime: currentIndex, remainingTimeSeconds: remainingSeconds },
        );
        setViolationCount(res.violationCount);
        if (res.examTerminated) {
          setFinalScreen({ reason: res.actionTaken });
          return;
        }
        if (res.actionTaken === 'WARNED') {
          setLastViolationMessage(describeViolation(type));
          setWarningOpen(true);
        }
      } catch {
        // best-effort — never block the student on a logging failure
      }
    },
    [attemptId, state, finalScreen, currentIndex, remainingSeconds],
  );

  const { enterFullscreen } = useIntegrityMonitor({
    enabled: !!state && !finalScreen,
    requireFullscreen: state?.assessment.requireFullscreen ?? false,
    onViolation: reportViolation,
  });

  useEffect(() => {
    if (state?.assessment.requireFullscreen) enterFullscreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.attemptId]);

  // ── Autosave ───────────────────────────────────────────────────────────
  const flushSave = useCallback(
    async (questionId: string) => {
      const answer = answers[questionId];
      if (!answer) return;
      setSaveStatus('saving');
      try {
        await api.post(`/attempts/${attemptId}/save-answer`, {
          questionId,
          selectedOptionIds: answer.selectedOptionIds,
          textAnswer: answer.textAnswer || undefined,
          codeAnswer: answer.codeAnswer || undefined,
          isMarkedForReview: markedForReview[questionId] ?? false,
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('offline');
      }
    },
    [answers, markedForReview, attemptId],
  );

  const scheduleSave = useCallback(
    (questionId: string) => {
      pendingQueue.current.add(questionId);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        pendingQueue.current.forEach((id) => flushSave(id));
        pendingQueue.current.clear();
      }, 800);
    },
    [flushSave],
  );

  const currentQuestion = state?.questions[currentIndex];

  const updateAnswer = (questionId: string, patch: Partial<LocalAnswer>) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] ?? emptyAnswer()), ...patch } }));
    scheduleSave(questionId);
  };

  const toggleMarkForReview = () => {
    if (!currentQuestion) return;
    setMarkedForReview((prev) => {
      const next = { ...prev, [currentQuestion.questionId]: !prev[currentQuestion.questionId] };
      return next;
    });
    scheduleSave(currentQuestion.questionId);
  };

  const goTo = (index: number) => {
    if (!state) return;
    setCurrentIndex(Math.max(0, Math.min(state.questions.length - 1, index)));
    api.post(`/attempts/${attemptId}/navigate/${index}`).catch(() => {});
  };

  const isAnswered = (questionId: string) => {
    const a = answers[questionId];
    if (!a) return false;
    return a.selectedOptionIds.length > 0 || a.textAnswer.trim().length > 0 || a.codeAnswer.trim().length > 0;
  };

  const summary = useMemo(() => {
    if (!state) return { answered: 0, unanswered: 0, marked: 0, total: 0 };
    const total = state.questions.length;
    const answered = state.questions.filter((q) => isAnswered(q.questionId)).length;
    const marked = state.questions.filter((q) => markedForReview[q.questionId]).length;
    return { answered, unanswered: total - answered, marked, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, answers, markedForReview]);

  const handleSubmit = async () => {
    setSubmitting(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await Promise.all([...pendingQueue.current].map((id) => flushSave(id)));
    try {
      await api.post(`/attempts/${attemptId}/submit`);
      setFinalScreen({ reason: 'STUDENT_SUBMITTED' });
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Submission failed — please try again.');
    } finally {
      setSubmitting(false);
      setSubmitModalOpen(false);
    }
  };

  if (loading) return <LoadingBlock label="Preparing your examination..." />;
  if (loadError && !state && !finalScreen)
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-[var(--danger)]">
        {loadError}
      </div>
    );

  if (finalScreen) return <FinalScreen reason={finalScreen.reason} onDone={() => router.replace('/student/dashboard')} />;
  if (!state || !currentQuestion) return null;

  const timeCritical = remainingSeconds < 300;

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-white px-6 py-3">
        <p className="font-semibold text-foreground">{state.assessment.title}</p>
        <p className="text-sm text-muted">
          Question {currentIndex + 1} of {state.questions.length}
        </p>
        <div className="flex items-center gap-4">
          <SaveIndicator status={isOnline ? saveStatus : 'offline'} />
          <div
            className={clsx(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums',
              timeCritical ? 'bg-[var(--danger-bg)] text-[var(--danger)]' : 'bg-slate-100 text-foreground',
            )}
          >
            <Clock size={15} />
            {formatTime(remainingSeconds)}
          </div>
        </div>
      </header>

      {!isOnline && (
        <div className="flex items-center gap-2 bg-[var(--warning-bg)] px-6 py-1.5 text-xs text-[var(--warning)]">
          <WifiOff size={14} /> Connection lost. Your recent responses are being preserved locally and will sync once you&apos;re back online.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Question navigator */}
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-white p-4 md:block">
          <div className="grid grid-cols-5 gap-2">
            {state.questions.map((q, i) => {
              const answered = isAnswered(q.questionId);
              const marked = markedForReview[q.questionId];
              return (
                <button
                  key={q.questionId}
                  onClick={() => goTo(i)}
                  className={clsx(
                    'flex h-9 w-9 items-center justify-center rounded-md text-xs font-medium transition-colors',
                    i === currentIndex && 'ring-2 ring-[var(--accent)]',
                    marked && answered && 'bg-purple-200 text-purple-900',
                    marked && !answered && 'bg-purple-100 text-purple-700',
                    !marked && answered && 'bg-[var(--success-bg)] text-[var(--success)]',
                    !marked && !answered && 'bg-slate-100 text-slate-600',
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-6 space-y-2 text-xs text-muted">
            <LegendRow color="bg-slate-100" label="Not answered" />
            <LegendRow color="bg-[var(--success-bg)]" label="Answered" />
            <LegendRow color="bg-purple-100" label="Marked for review" />
            <LegendRow color="bg-purple-200" label="Answered + marked" />
          </div>
          <div className="mt-6 space-y-1 border-t border-[var(--border)] pt-4 text-xs">
            <p>
              Answered: <strong>{summary.answered}</strong>
            </p>
            <p>
              Unanswered: <strong>{summary.unanswered}</strong>
            </p>
            <p>
              Marked for review: <strong>{summary.marked}</strong>
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-[var(--primary)]">
                {currentQuestion.marks} mark{currentQuestion.marks !== 1 ? 's' : ''}
                {currentQuestion.negativeMarks > 0 && ` · −${currentQuestion.negativeMarks} if incorrect`}
              </span>
              <span className="text-xs uppercase tracking-wide text-muted">{currentQuestion.difficulty}</span>
            </div>
            <h2 className="mb-4 text-base font-semibold text-foreground">{currentQuestion.title}</h2>

            <QuestionRenderer
              question={currentQuestion}
              answer={answers[currentQuestion.questionId] ?? emptyAnswer()}
              onChange={(patch) => updateAnswer(currentQuestion.questionId, patch)}
            />
          </div>
        </main>
      </div>

      {/* Bottom navigation */}
      <footer className="flex items-center justify-between border-t border-[var(--border)] bg-white px-6 py-3">
        <Button variant="outline" disabled={currentIndex === 0} onClick={() => goTo(currentIndex - 1)}>
          ← Previous
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={toggleMarkForReview}>
            <Flag size={14} />
            {markedForReview[currentQuestion.questionId] ? 'Unmark' : 'Mark for Review'}
          </Button>
          {currentIndex < state.questions.length - 1 ? (
            <Button onClick={() => goTo(currentIndex + 1)}>Save &amp; Next →</Button>
          ) : (
            <Button variant="danger" onClick={() => setSubmitModalOpen(true)}>
              Submit Examination
            </Button>
          )}
        </div>
      </footer>

      {/* Violation warning overlay */}
      <Modal open={warningOpen} onClose={() => setWarningOpen(false)} title="⚠ Examination Integrity Warning">
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 text-[var(--warning)]">
            <AlertTriangle size={18} /> {lastViolationMessage}
          </p>
          <p>
            Violation Count: <strong>{violationCount}</strong> / {state.assessment.violationLimit}
          </p>
          <p className="text-muted">
            Please remain in the examination environment. Further violations may result in automatic submission of
            your examination.
          </p>
          <Button className="w-full" onClick={() => setWarningOpen(false)}>
            Return to Examination
          </Button>
        </div>
      </Modal>

      {/* Submit confirmation */}
      <Modal open={submitModalOpen} onClose={() => setSubmitModalOpen(false)} title="Examination Summary">
        <div className="space-y-3 text-sm">
          <SummaryRow label="Total Questions" value={summary.total} />
          <SummaryRow label="Answered" value={summary.answered} />
          <SummaryRow label="Unanswered" value={summary.unanswered} />
          <SummaryRow label="Marked for Review" value={summary.marked} />
          <p className="pt-2 text-muted">Are you sure you want to submit your examination? This cannot be undone.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setSubmitModalOpen(false)}>
              ← Return to Examination
            </Button>
            <Button variant="danger" className="flex-1" loading={submitting} onClick={handleSubmit}>
              <Check size={14} /> Submit Examination
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function describeViolation(type: string) {
  const map: Record<string, string> = {
    TAB_SWITCH: 'We detected that you switched away from the examination tab.',
    WINDOW_BLUR: 'We detected that the examination window lost focus.',
    FULLSCREEN_EXIT: 'We detected that you exited fullscreen mode.',
    PAGE_REFRESH: 'A page refresh attempt was detected.',
    NAVIGATION_ATTEMPT: 'A navigation (back button) attempt was detected.',
    COPY_PASTE: 'Copy/paste is disabled during this examination.',
  };
  return map[type] ?? 'We detected that you left the examination environment.';
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'offline') return <span className="text-xs text-[var(--danger)]">⚠ Offline</span>;
  if (status === 'saving') return <span className="text-xs text-muted">Saving...</span>;
  if (status === 'saved') return <span className="text-xs text-[var(--success)]">✓ Saved</span>;
  return null;
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={clsx('h-3 w-3 rounded-sm', color)} />
      {label}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FinalScreen({ reason, onDone }: { reason: string; onDone: () => void }) {
  const messages: Record<string, string> = {
    STUDENT_SUBMITTED: 'Your examination has been submitted successfully.',
    TIME_EXPIRED: 'Time expired — your examination was automatically submitted.',
    AUTO_SUBMITTED: 'Your examination was automatically submitted.',
    TERMINATED: 'Your examination was terminated due to a policy violation.',
    ADMIN_TERMINATED: 'Your examination was ended by the administrator.',
    SUBMITTED: 'Your examination has been submitted.',
    EVALUATED: 'Your examination has already been evaluated.',
  };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
        <Check size={28} />
      </div>
      <h1 className="text-lg font-semibold">Examination Submitted</h1>
      <p className="max-w-sm text-sm text-muted">{messages[reason] ?? 'Your examination has ended.'}</p>
      <Button onClick={onDone}>Return to Dashboard</Button>
    </div>
  );
}
