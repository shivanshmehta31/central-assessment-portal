'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, ErrorBanner, Input, Label, LoadingBlock, Select } from '@/components/ui/primitives';

interface Settings {
  institutionName: string;
  academicYear: string;
  defaultExamDurationMinutes: number;
  defaultViolationLimit: number;
  defaultViolationAction: string;
  passwordMinLength: number;
  sessionDurationMinutes: number;
}

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<Settings>('/settings').then(setForm);
  }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setMsg('');
    try {
      await api.patch('/settings', form);
      setMsg('Settings saved.');
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <LoadingBlock />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">System Settings</h1>
        <p className="text-sm text-muted">Institution-wide defaults.</p>
      </div>

      {msg && <ErrorBanner message={msg} tone="success" />}

      <Card className="space-y-4">
        <div>
          <Label>Institution Name</Label>
          <Input value={form.institutionName} onChange={(e) => setForm({ ...form, institutionName: e.target.value })} />
        </div>
        <div>
          <Label>Academic Year</Label>
          <Input value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Default Exam Duration (minutes)</Label>
            <Input
              type="number"
              value={form.defaultExamDurationMinutes}
              onChange={(e) => setForm({ ...form, defaultExamDurationMinutes: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Session Duration (minutes)</Label>
            <Input
              type="number"
              value={form.sessionDurationMinutes}
              onChange={(e) => setForm({ ...form, sessionDurationMinutes: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Default Violation Limit</Label>
            <Input
              type="number"
              value={form.defaultViolationLimit}
              onChange={(e) => setForm({ ...form, defaultViolationLimit: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Default Violation Policy</Label>
            <Select value={form.defaultViolationAction} onChange={(e) => setForm({ ...form, defaultViolationAction: e.target.value })}>
              <option value="LOG_ONLY">Log Only</option>
              <option value="WARN">Warn</option>
              <option value="AUTO_SUBMIT">Auto-Submit</option>
              <option value="TERMINATE">Terminate</option>
            </Select>
          </div>
          <div>
            <Label>Password Minimum Length</Label>
            <Input
              type="number"
              value={form.passwordMinLength}
              onChange={(e) => setForm({ ...form, passwordMinLength: Number(e.target.value) })}
            />
          </div>
        </div>
        <Button loading={saving} onClick={save}>
          Save Settings
        </Button>
      </Card>
    </div>
  );
}
