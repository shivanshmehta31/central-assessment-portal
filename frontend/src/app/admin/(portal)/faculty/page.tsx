'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookPlus, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Label, LoadingBlock, Modal, Select } from '@/components/ui/primitives';
import { SubjectModal, type SubjectRow } from '@/components/academics/subject-modal';

interface Department {
  id: string;
  name: string;
}
interface Faculty {
  id: string;
  name: string;
  facultyCode: string;
  designation: string | null;
  phone: string | null;
  departmentId: string;
  department: Department;
  user: { email: string; status: string };
  facultySubjects: { subject: SubjectRow }[];
}

// Checkbox list of subjects with an inline "add a new subject" shortcut.
function SubjectChecklist({
  subjects,
  selected,
  onToggle,
  onAddNew,
}: {
  subjects: SubjectRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAddNew: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label>Subjects</Label>
        <button type="button" className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline" onClick={onAddNew}>
          <BookPlus size={12} /> Add new subject
        </button>
      </div>
      <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
        {subjects.length === 0 && <p className="p-2 text-sm text-muted">No subjects yet — add one above.</p>}
        {subjects.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={selected.has(s.id)} onChange={() => onToggle(s.id)} />
            {s.name}
            <span className="text-xs text-muted">{s.code}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

const toggleIn = (set: Set<string>, id: string) => {
  const next = new Set(set);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
};

export default function FacultyPage() {
  const [items, setItems] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [managing, setManaging] = useState<Faculty | null>(null);

  const load = useCallback(() => {
    api
      .get<Faculty[]>('/faculty')
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadSubjects = useCallback(() => {
    api.get<SubjectRow[]>('/subjects').then(setSubjects).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    loadSubjects();
    api.get<Department[]>('/departments').then(setDepartments).catch(() => {});
  }, [load, loadSubjects]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Faculty Management</h1>
          <p className="text-sm text-muted">
            {items.length} faculty member{items.length === 1 ? '' : 's'} · {subjects.length} subject{subjects.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSubjectOpen(true)}>
            <BookPlus size={15} /> Add Subject
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Add Faculty
          </Button>
        </div>
      </div>

      {message && <ErrorBanner message={message} tone="success" />}

      <Card>
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && items.length === 0 && <EmptyState title="No faculty members yet" description="Use “Add Faculty” to create the first one." />}
        {!loading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
                  <th className="py-2">Faculty</th>
                  <th className="py-2">Department</th>
                  <th className="py-2">Subjects</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--border)] align-top last:border-0">
                    <td className="py-2.5">
                      <p className="font-medium">{f.name}</p>
                      <p className="text-xs text-muted">
                        {f.facultyCode} · {f.user.email}
                      </p>
                      {f.designation && <p className="text-xs text-muted">{f.designation}</p>}
                    </td>
                    <td className="py-2.5">{f.department?.name}</td>
                    <td className="py-2.5">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {f.facultySubjects.length === 0 && <span className="text-xs text-muted">None assigned</span>}
                        {f.facultySubjects.map((fs) => (
                          <Badge key={fs.subject.id} tone="info">
                            {fs.subject.name}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <Badge tone={f.user.status === 'ACTIVE' ? 'success' : 'neutral'}>{f.user.status}</Badge>
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <button className="text-[var(--accent)] hover:underline" onClick={() => setManaging(f)}>
                          Subjects
                        </button>
                        <button className="text-[var(--accent)] hover:underline" onClick={() => setEditing(f)}>
                          Edit
                        </button>
                        <button className="text-[var(--accent)] hover:underline" onClick={() => toggleStatus(f)}>
                          {f.user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="text-[var(--accent)] hover:underline" onClick={() => resetPassword(f)}>
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

      <SubjectModal open={subjectOpen} onClose={() => setSubjectOpen(false)} onSaved={() => loadSubjects()} />
      <FacultyFormModal
        key={editing?.id ?? 'new'}
        open={addOpen || !!editing}
        faculty={editing}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        departments={departments}
        subjects={subjects}
        onSubjectCreated={loadSubjects}
        onSaved={(msg) => {
          if (msg) setMessage(msg);
          load();
        }}
      />
      <ManageSubjectsModal
        faculty={managing}
        subjects={subjects}
        onClose={() => setManaging(null)}
        onSubjectCreated={loadSubjects}
        onSaved={(msg) => {
          setMessage(msg);
          load();
        }}
      />
    </div>
  );
}

// Create a faculty member, or edit one's details (pass `faculty`).
function FacultyFormModal({
  open,
  faculty,
  onClose,
  departments,
  subjects,
  onSubjectCreated,
  onSaved,
}: {
  open: boolean;
  faculty: Faculty | null;
  onClose: () => void;
  departments: Department[];
  subjects: SubjectRow[];
  onSubjectCreated: () => void;
  onSaved: (message?: string) => void;
}) {
  const editing = !!faculty;
  const [form, setForm] = useState({ name: '', email: '', facultyCode: '', departmentId: '', designation: '', phone: '' });
  const [subjectIds, setSubjectIds] = useState<Set<string>>(new Set());
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSubjectIds(new Set());
    setForm({
      name: faculty?.name ?? '',
      email: faculty?.user.email ?? '',
      facultyCode: faculty?.facultyCode ?? '',
      departmentId: faculty?.departmentId ?? (departments.length === 1 ? departments[0].id : ''),
      designation: faculty?.designation ?? '',
      phone: faculty?.phone ?? '',
    });
  }, [open, faculty, departments]);

  const valid = form.name.trim() && form.email.trim() && form.departmentId && (editing || form.facultyCode.trim());

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.patch(`/faculty/${faculty!.id}`, {
          name: form.name,
          email: form.email,
          departmentId: form.departmentId,
          designation: form.designation || undefined,
          phone: form.phone || undefined,
        });
        onSaved(`Updated ${form.name}.`);
      } else {
        const res = await api.post<{ temporaryPassword: string }>('/faculty', {
          ...form,
          designation: form.designation || undefined,
          phone: form.phone || undefined,
          subjectIds: [...subjectIds],
        });
        onSaved(`Created ${form.name}. Temporary password: ${res.temporaryPassword} (shown once — share it securely).`);
      }
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save faculty');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={editing ? 'Edit Faculty' : 'Add Faculty'}>
        <div className="space-y-3">
          {error && <ErrorBanner message={error} />}
          <div>
            <Label>Full name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Faculty ID</Label>
              <Input value={form.facultyCode} disabled={editing} onChange={(e) => setForm({ ...form, facultyCode: e.target.value })} placeholder="e.g. FAC-002" />
            </div>
            <div>
              <Label>Designation</Label>
              <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
            </div>
          </div>
          {!editing && (
            <SubjectChecklist
              subjects={subjects}
              selected={subjectIds}
              onToggle={(id) => setSubjectIds((s) => toggleIn(s, id))}
              onAddNew={() => setSubjectOpen(true)}
            />
          )}
          <Button className="w-full" loading={saving} disabled={!valid} onClick={submit}>
            {editing ? 'Save changes' : 'Create faculty'}
          </Button>
          {!valid && <p className="text-center text-xs text-muted">Name, email, {editing ? '' : 'faculty ID, '}and department are required.</p>}
        </div>
      </Modal>
      <SubjectModal
        open={subjectOpen}
        onClose={() => setSubjectOpen(false)}
        onSaved={(s) => {
          onSubjectCreated();
          setSubjectIds((prev) => new Set(prev).add(s.id)); // new subject is selected automatically
        }}
      />
    </>
  );
}

// Assign / change the subjects of an existing faculty member.
function ManageSubjectsModal({
  faculty,
  subjects,
  onClose,
  onSubjectCreated,
  onSaved,
}: {
  faculty: Faculty | null;
  subjects: SubjectRow[];
  onClose: () => void;
  onSubjectCreated: () => void;
  onSaved: (message: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (faculty) {
      setSelected(new Set(faculty.facultySubjects.map((fs) => fs.subject.id)));
      setError('');
    }
  }, [faculty]);

  const save = async () => {
    if (!faculty) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/faculty/${faculty.id}/subjects`, { subjectIds: [...selected] });
      onSaved(`Updated subjects for ${faculty.name} (${selected.size} assigned).`);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update subjects');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal open={!!faculty} onClose={onClose} title={faculty ? `Subjects — ${faculty.name}` : 'Subjects'}>
        <div className="space-y-3">
          {error && <ErrorBanner message={error} />}
          <p className="text-sm text-muted">Faculty can create question papers and evaluate assessments only for the subjects assigned here.</p>
          <SubjectChecklist
            subjects={subjects}
            selected={selected}
            onToggle={(id) => setSelected((s) => toggleIn(s, id))}
            onAddNew={() => setSubjectOpen(true)}
          />
          <Button className="w-full" loading={saving} onClick={save}>
            Save subjects
          </Button>
        </div>
      </Modal>
      <SubjectModal
        open={subjectOpen}
        onClose={() => setSubjectOpen(false)}
        onSaved={(s) => {
          onSubjectCreated();
          setSelected((prev) => new Set(prev).add(s.id));
        }}
      />
    </>
  );
}
