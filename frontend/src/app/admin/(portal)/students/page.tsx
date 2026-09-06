'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Upload, Search, KeyRound } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Input,
  Label,
  LoadingBlock,
  Modal,
  Select,
} from '@/components/ui/primitives';

interface Department {
  id: string;
  name: string;
}
interface Student {
  id: string;
  studentCode: string;
  enrollmentNumber: string;
  name: string;
  department: Department;
  semester: number | null;
  section: string | null;
  batch: string | null;
  user: { email: string; status: string };
}

export default function StudentsPage() {
  const [items, setItems] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [credentialMsg, setCredentialMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ items: Student[]; total: number }>(`/students?search=${encodeURIComponent(search)}&pageSize=50`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    load();
    api.get<Department[]>('/departments').then(setDepartments).catch(() => {});
  }, [load]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const bulkStatus = async (activate: boolean) => {
    if (!selected.size) return;
    await api.post('/students/bulk-status', { studentIds: [...selected], activate });
    setSelected(new Set());
    load();
  };

  const toggleStatus = async (s: Student) => {
    await api.patch(`/students/${s.id}/status/${s.user.status !== 'ACTIVE'}`);
    load();
  };

  const resetPassword = async (s: Student) => {
    const res = await api.post<{ temporaryPassword: string }>(`/students/${s.id}/reset-password`);
    setCredentialMsg(`New temporary password for ${s.name}: ${res.temporaryPassword}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Student Management</h1>
          <p className="text-sm text-muted">{total} registered students</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={15} /> Import
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Add Student
          </Button>
        </div>
      </div>

      {credentialMsg && <ErrorBanner message={credentialMsg} tone="success" />}

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input placeholder="Search by name, ID, or enrollment no." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">{selected.size} selected</span>
              <Button size="sm" variant="secondary" onClick={() => bulkStatus(true)}>
                Activate
              </Button>
              <Button size="sm" variant="secondary" onClick={() => bulkStatus(false)}>
                Deactivate
              </Button>
            </div>
          )}
        </div>

        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No students found" />}

        {!loading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
                  <th className="w-8 py-2"></th>
                  <th className="py-2">Student</th>
                  <th className="py-2">Department</th>
                  <th className="py-2">Sem / Section / Batch</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} />
                    </td>
                    <td className="py-2.5">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted">
                        {s.studentCode} · {s.user.email}
                      </p>
                    </td>
                    <td className="py-2.5">{s.department?.name}</td>
                    <td className="py-2.5 text-xs text-muted">
                      {s.semester ?? '—'} / {s.section ?? '—'} / {s.batch ?? '—'}
                    </td>
                    <td className="py-2.5">
                      <Badge tone={s.user.status === 'ACTIVE' ? 'success' : 'neutral'}>{s.user.status}</Badge>
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-2">
                        <button className="text-xs text-[var(--accent)] hover:underline" onClick={() => toggleStatus(s)}>
                          {s.user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                          onClick={() => resetPassword(s)}
                        >
                          <KeyRound size={12} /> Reset password
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

      <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} departments={departments} onCreated={load} />
      <ImportStudentsModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />
    </div>
  );
}

function AddStudentModal({
  open,
  onClose,
  departments,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  departments: Department[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    studentCode: '',
    enrollmentNumber: '',
    departmentId: '',
    semester: '',
    section: '',
    batch: '',
  });
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api.post<{ temporaryPassword: string }>('/students', {
        ...form,
        semester: form.semester ? Number(form.semester) : undefined,
      });
      setResult(`Student created. Temporary password: ${res.temporaryPassword}`);
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create student');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Student">
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
              <Label>Student ID</Label>
              <Input value={form.studentCode} onChange={(e) => setForm({ ...form, studentCode: e.target.value })} />
            </div>
            <div>
              <Label>Enrollment Number</Label>
              <Input value={form.enrollmentNumber} onChange={(e) => setForm({ ...form, enrollmentNumber: e.target.value })} />
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Semester</Label>
              <Input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} />
            </div>
            <div>
              <Label>Section</Label>
              <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
            </div>
            <div>
              <Label>Batch</Label>
              <Input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} />
            </div>
          </div>
          <Button className="w-full" loading={saving} onClick={submit}>
            Create Student
          </Button>
        </div>
      )}
    </Modal>
  );
}

function ImportStudentsModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ total: number; succeeded: number; failed: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      const res = await api.upload<{ total: number; succeeded: number; failed: number }>(
        isExcel ? '/students/import/excel' : '/students/import/csv',
        file,
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
    <Modal open={open} onClose={onClose} title="Bulk Import Students">
      <div className="space-y-3 text-sm">
        <p className="text-muted">
          Upload a CSV or Excel file with columns: name, email, studentCode, enrollmentNumber, departmentId, branch,
          semester, section, batch.
        </p>
        {error && <ErrorBanner message={error} />}
        {result ? (
          <div className="rounded-lg bg-slate-50 p-3">
            <p>Total rows: {result.total}</p>
            <p className="text-[var(--success)]">Succeeded: {result.succeeded}</p>
            <p className="text-[var(--danger)]">Failed: {result.failed}</p>
          </div>
        ) : (
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button className="flex-1" loading={uploading} disabled={!file} onClick={submit}>
              Upload &amp; Import
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
