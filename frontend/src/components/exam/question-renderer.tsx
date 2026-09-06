'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { CodeEditor } from './code-editor';
import { Button } from '@/components/ui/primitives';
import type { ExamQuestion } from '@/lib/types';

export interface LocalAnswer {
  selectedOptionIds: string[];
  textAnswer: string;
  codeAnswer: string;
}

const CODE_TYPES = ['CODING', 'CODE_COMPLETION', 'CODE_DEBUGGING'];

export function QuestionRenderer({
  question,
  answer,
  onChange,
}: {
  question: ExamQuestion;
  answer: LocalAnswer;
  onChange: (next: Partial<LocalAnswer>) => void;
}) {
  const [consoleOutput, setConsoleOutput] = useState<string | null>(null);

  const renderPrompt = () => (
    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
      {question.description}
    </div>
  );

  if (question.type === 'MCQ' || question.type === 'TRUE_FALSE') {
    return (
      <div className="space-y-4">
        {renderPrompt()}
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm hover:bg-slate-50 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-blue-50"
            >
              <input
                type="radio"
                name={question.questionId}
                checked={answer.selectedOptionIds[0] === opt.id}
                onChange={() => onChange({ selectedOptionIds: [opt.id] })}
              />
              {opt.text}
            </label>
          ))}
        </div>
        {answer.selectedOptionIds.length > 0 && (
          <button className="text-xs text-muted hover:underline" onClick={() => onChange({ selectedOptionIds: [] })}>
            Clear response
          </button>
        )}
      </div>
    );
  }

  if (question.type === 'MULTIPLE_SELECT') {
    const toggle = (id: string) => {
      const set = new Set(answer.selectedOptionIds);
      set.has(id) ? set.delete(id) : set.add(id);
      onChange({ selectedOptionIds: [...set] });
    };
    return (
      <div className="space-y-4">
        {renderPrompt()}
        <div className="space-y-2">
          {question.options.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3 text-sm hover:bg-slate-50 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-blue-50"
            >
              <input type="checkbox" checked={answer.selectedOptionIds.includes(opt.id)} onChange={() => toggle(opt.id)} />
              {opt.text}
            </label>
          ))}
        </div>
        {answer.selectedOptionIds.length > 0 && (
          <button className="text-xs text-muted hover:underline" onClick={() => onChange({ selectedOptionIds: [] })}>
            Clear response
          </button>
        )}
      </div>
    );
  }

  if (question.type === 'SHORT_ANSWER') {
    return (
      <div className="space-y-3">
        {renderPrompt()}
        <input
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          value={answer.textAnswer}
          maxLength={question.characterLimit ?? undefined}
          onChange={(e) => onChange({ textAnswer: e.target.value })}
          placeholder="Type your answer..."
        />
        {question.characterLimit && (
          <p className="text-xs text-muted">
            {answer.textAnswer.length} / {question.characterLimit} characters
          </p>
        )}
      </div>
    );
  }

  if (question.type === 'DESCRIPTIVE' || question.type === 'DATASET_ANALYSIS' || question.type === 'VISUALIZATION_INTERPRETATION') {
    const wordCount = answer.textAnswer.trim() ? answer.textAnswer.trim().split(/\s+/).length : 0;
    return (
      <div className="space-y-3">
        {renderPrompt()}
        {question.datasetId && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
            A dataset preview is attached to this question by your instructor.
            {question.allowDatasetDownload ? ' Download is enabled.' : ''}
          </p>
        )}
        <textarea
          className="min-h-[160px] w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          value={answer.textAnswer}
          onChange={(e) => onChange({ textAnswer: e.target.value })}
          placeholder="Write your answer..."
        />
        <p className="text-xs text-muted">
          {wordCount} words{question.wordLimit ? ` / ${question.wordLimit} word limit` : ''} · {answer.textAnswer.length} characters
        </p>
      </div>
    );
  }

  if (question.type === 'CODE_OUTPUT_PREDICTION') {
    return (
      <div className="space-y-3">
        {renderPrompt()}
        <textarea
          className="min-h-[100px] w-full rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
          value={answer.textAnswer}
          onChange={(e) => onChange({ textAnswer: e.target.value })}
          placeholder="Predicted output..."
        />
      </div>
    );
  }

  if (CODE_TYPES.includes(question.type)) {
    const initialCode = answer.codeAnswer || question.starterCode || question.incorrectCode || '';
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {renderPrompt()}
          {question.constraints && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              <p className="font-medium text-slate-700">Constraints</p>
              <p className="mt-1 whitespace-pre-wrap text-muted">{question.constraints}</p>
            </div>
          )}
          {question.sampleInput && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              <p className="font-medium text-slate-700">Sample Input</p>
              <pre className="mt-1 whitespace-pre-wrap text-muted">{question.sampleInput}</pre>
            </div>
          )}
          {question.sampleOutput && (
            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              <p className="font-medium text-slate-700">Sample Output</p>
              <pre className="mt-1 whitespace-pre-wrap text-muted">{question.sampleOutput}</pre>
            </div>
          )}
          {question.incorrectCode && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              This code contains a bug. Correct it in the editor and submit your fixed version.
            </div>
          )}
        </div>

        <div className="space-y-2">
          <CodeEditor value={initialCode} onChange={(v) => onChange({ codeAnswer: v })} language={question.language ?? 'python'} />
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setConsoleOutput(
                  'Live sandboxed execution is not available in this environment yet — your code will be compiled and evaluated by faculty against the configured test cases.',
                )
              }
            >
              <Play size={14} /> Run Code
            </Button>
          </div>
          {consoleOutput && (
            <div className="rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">{consoleOutput}</div>
          )}
        </div>
      </div>
    );
  }

  return renderPrompt();
}
