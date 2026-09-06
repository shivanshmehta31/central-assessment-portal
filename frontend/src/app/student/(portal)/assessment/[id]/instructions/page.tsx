'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, ErrorBanner, LoadingBlock } from '@/components/ui/primitives';

interface Instructions {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  totalQuestions: number;
  totalMarks: number;
  durationMinutes: number;
  startAt: string;
  endAt: string;
  deviceRestriction: string;
  requireFullscreen: boolean;
  violationLimit: number;
  violationAction: string;
  maxAttempts: number;
}

const INSTRUCTIONS = [
  'The examination has a fixed time limit that starts as soon as you click "Start Examination".',
  'Your answers are automatically saved as you work — you do not need to save manually.',
  'Do not refresh the page or close the examination window once started.',
  'Switching tabs or leaving the examination environment may be recorded as a suspicious activity.',
  'Depending on this assessment’s settings, repeated violations may result in automatic submission or termination.',
  'The examination will automatically submit when the timer reaches zero.',
  'Ensure a stable internet connection before starting — answers are cached locally if the connection drops briefly.',
  'Read every question carefully before submitting your final answer.',
];

export default function InstructionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Instructions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const [checks, setChecks] = useState({ online: true, fullscreenAvailable: true, screenOk: true });

  useEffect(() => {
    setChecks({
      online: navigator.onLine,
      fullscreenAvailable: !!document.documentElement.requestFullscreen,
      screenOk: window.innerWidth >= 768,
    });
  }, []);

  useEffect(() => {
    api
      .get<Instructions>(`/attempts/instructions/${params.id}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load assessment'))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleStart = async () => {
    setStarting(true);
    setError('');
    try {
      const state = await api.post<{ attemptId: string }>('/attempts/start', { assessmentId: params.id });
      router.push(`/student/exam/${state.attemptId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to start the examination');
      setStarting(false);
    }
  };

  if (loading) return <LoadingBlock label="Loading examination details..." />;
  if (error && !data) return <ErrorBanner message={error} />;
  if (!data) return null;

  const allChecksPass = checks.online && checks.fullscreenAvailable;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <h1 className="text-lg font-semibold">{data.title}</h1>
        <p className="text-sm text-muted">{data.subject}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Total Questions" value={data.totalQuestions} />
          <Stat label="Total Marks" value={data.totalMarks} />
          <Stat label="Duration" value={`${data.durationMinutes} min`} />
          <Stat label="Max Attempts" value={data.maxAttempts} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Available: {format(new Date(data.startAt), 'dd MMM yyyy, HH:mm')} – {format(new Date(data.endAt), 'dd MMM yyyy, HH:mm')}
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Important Instructions</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          {INSTRUCTIONS.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
        {data.requireFullscreen && (
          <p className="mt-3 rounded-lg bg-[var(--warning-bg)] p-3 text-sm text-[var(--warning)]">
            This assessment requires fullscreen mode and monitors tab-switching. Violation policy:{' '}
            <strong>{data.violationAction.replace('_', ' ')}</strong> after {data.violationLimit} violation(s).
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">System Check</h2>
        <div className="space-y-2 text-sm">
          <CheckRow ok={checks.online} label="Internet Connection" />
          <CheckRow ok={checks.fullscreenAvailable} label="Fullscreen Available" />
          <CheckRow ok={checks.screenOk} label="Screen Size Suitable" warn />
        </div>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          I have read and understood all examination instructions.
        </label>
        <Button
          className="mt-4 w-full"
          size="lg"
          disabled={!acknowledged || !allChecksPass}
          loading={starting}
          onClick={handleStart}
        >
          Start Examination
        </Button>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function CheckRow({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 size={16} className="text-[var(--success)]" />
      ) : (
        <XCircle size={16} className={warn ? 'text-[var(--warning)]' : 'text-[var(--danger)]'} />
      )}
      {label}
    </div>
  );
}
