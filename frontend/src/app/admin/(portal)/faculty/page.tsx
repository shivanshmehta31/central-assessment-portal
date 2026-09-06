'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Label, LoadingBlock, Modal, Select } from '@/components/ui/primitives';

interface Department {
  id: string;
  name: string;
}
interface Subject {
  id: string;
  name: string;
}
interface Faculty {
  id: string;
  name: string;
  facultyCode: string;
  designation: string | null;
  department: Department;
  user: { email: string; status: string };
  facultySubjects: { subject: Subject }[];
}

export default function FacultyPage() {
  const [items, setItems] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Faculty[]>('/faculty')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api.get<Department[]>('/departments').then(setDepartments).catch(() => {});
    api.get<Subject[]>('/subjects').then(setSubjects).catch(() => {});
  }, [load]);

  const toggleStatus = async (f: Faculty) => {
    await api.patch(`/faculty/${f.id}/status/${f.user.status !== 'ACTIVE'}`);
    load();
  };

  const resetPassword = async (f: Faculty) => {
    const res = await api.post<{ temporaryPassword: string }>(`/faculty/${f.id}/reset-password`);
    setMessage(`New temporary password for ${f.name}: ${res.temporaryPassword}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Faculty Management</h1>
          <p className="text-sm text-muted">{items.length} faculty members</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={15} /> Add Faculty
        </Button>
      </div>

      {message && <ErrorBanner message={message} tone="success" />}

      <Card>
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No faculty members yet" />}
        {!loading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
                  <th className="py-2">Faculty</th>
                  <th className="py-2">Department</th>
                  <th className="py-2">Assigned Subjects</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5">
                      <p className="font-medium">{f.name}</p>
                      <p className="text-xs text-muted">
                        {f.facultyCode} · {f.user.email}
                      </p>
                    </td>
                    <td className="py-2.5">{f.department?.name}</td>
                    <td className="py-2.5 text-xs text-muted">
                      {f.facultySubjects.map((fs) => fs.subject.name).join(', ') || '—'}
                    </td>
                    <td className="py-2.5">
                      <Badge tone={f.user.status === 'ACTIVE' ? 'success' : 'neutral'}>{f.user.status}</Badge>
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-2">
                        <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => toggleStatus(f)}>
                          {f.user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => resetPassword(f)}>
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddFacultyModal open={addOpen} onClose={() => setAddOpen(false)} departments={departments} subjects={subjects} onCreated={load} />
    </div>
  );
}

function AddFacultyModal({
  open,
  onClose,
  departments,
  subjects,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  departments: Department[];
  subjects: Subject[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', facultyCode: '', departmentId: '', designation: '' });
  const [subjectIds, setSubjectIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post<{ temporaryPassword: string }>('/faculty', { ...form, subjectIds: [...subjectIds] });
      setResult(`Faculty created. Temporary password: ${res.temporaryPassword}`);
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create faculty');
    } finally {
      setSaving(false);
    }
  };

  const toggleSubject = (id: string) => {
    setSubjectIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Faculty">
      {result ? (
        <div className="space-y-3">
          <ErrorBanner message={result} tone="success" />
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {error && <ErrorBanner message={error} />}
          <div>
            <Label>Full Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Faculty ID</Label>
              <Input value={form.facultyCode} onChange={(e) => setForm({ ...form, facultyCode: e.target.value })} />
            </div>
            <div>
              <Label>Designation</Label>
              <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Department</Label>
            <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Assign Subjects</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
              {subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={subjectIds.has(s.id)} onChange={() => toggleSubject(s.id)} />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          <Button className="w-full" loading={saving} onClick={submit}>
            Create Faculty
          </Button>
        </div>
      )}
    </Modal>
  );
}
