'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, ErrorBanner, Input, Label, Modal, Select } from '@/components/ui/primitives';

export interface SubjectRow {
  id: string;
  name: string;
  code: string;
  courseId?: string;
  course?: { id: string; name: string } | null;
}

interface CourseOption {
  id: string;
  name: string;
}

// Create a subject, or rename/recode an existing one (pass `subject`).
export function SubjectModal({
  open,
  onClose,
  subject,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  subject?: SubjectRow | null;
  onSaved: (subject: SubjectRow) => void;
}) {
  const editing = !!subject;
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [courseId, setCourseId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(subject?.name ?? '');
    setCode(subject?.code ?? '');
    setError('');
    if (!editing) {
      api
        .get<CourseOption[]>('/courses')
        .then((list) => {
          setCourses(list);
          setCourseId((current) => current || list[0]?.id || '');
        })
        .catch(() => setCourses([]));
    }
  }, [open, subject, editing]);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const saved = editing
        ? await api.patch<SubjectRow>(`/subjects/${subject!.id}`, { name, code: code || undefined })
        : await api.post<SubjectRow>('/subjects', { name, courseId, code: code || undefined });
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the subject');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Subject' : 'Add Subject'}>
      <div className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <div>
          <Label>Subject name</Label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cloud Computing" />
        </div>
        <div>
          <Label>Subject code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={editing ? '' : 'Optional — generated from the name'} />
        </div>
        {!editing &&
          (courses.length === 1 ? (
            <p className="text-xs text-muted">
              Course: <span className="font-medium text-slate-700">{courses[0].name}</span>
            </p>
          ) : (
            <div>
              <Label>Course</Label>
              <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Select course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {courses.length === 0 && <p className="mt-1 text-xs text-muted">Create a course first (Academics → Courses).</p>}
            </div>
          ))}
        <Button className="w-full" loading={saving} disabled={!name.trim() || (!editing && !courseId)} onClick={submit}>
          {editing ? 'Save changes' : 'Add subject'}
        </Button>
      </div>
    </Modal>
  );
}
