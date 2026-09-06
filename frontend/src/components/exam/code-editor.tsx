'use client';

import dynamic from 'next/dynamic';

const Monaco = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center text-sm text-muted">Loading editor...</div>,
});

export function CodeEditor({
  value,
  onChange,
  language = 'python',
  height = '280px',
}: {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <Monaco
        height={height}
        language={language}
        value={value}
        onChange={(v) => onChange(v ?? '')}
        theme="vs-dark"
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
        }}
      />
    </div>
  );
}
