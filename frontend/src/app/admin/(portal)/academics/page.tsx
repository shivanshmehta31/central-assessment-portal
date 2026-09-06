'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import { api, ApiError } from '@/lib/api';
import { Button, Card, EmptyState, ErrorBanner, Input, Label, LoadingBlock, Modal, Select } from '@/components/ui/primitives';

interface Department {
  id: string;
  name: string;
  code: string;
}
interface Course {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  department: Department;
}
interface Subject {
  id: string;
  name: string;
  code: string;
  courseId: string;
  course: Course;
}

type Tab = 'departments' | 'courses' | 'subjects';

export default function AcademicsPage() {
  const [tab, setTab] = useState<Tab>('departments');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Department[]>('/departments'),
      api.get<Course[]>('/courses'),
      api.get<Subject[]>('/subjects'),
    ])
      .then(([d, c, s]) => {
        setDepartments(d);
        setCourses(c);
        setSubjects(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Academics</h1>
          <p className="text-sm text-muted">Departments, courses, and subjects.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={15} /> Add {tab === 'departments' ? 'Department' : tab === 'courses' ? 'Course' : 'Subject'}
        </Button>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm w-fit">
        {(['departments', 'courses', 'subjects'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx('rounded-md px-4 py-1.5 capitalize', tab === t ? 'bg-white shadow-sm font-medium' : 'text-muted')}
          >
            {t}
          </button>
        ))}
      </div>

      <Card>
        {loading && <LoadingBlock />}
        {error && <ErrorBanner message={error} />}
        {!loading && tab === 'departments' && (
          <SimpleTable
            rows={departments}
            empty="No departments yet"
            columns={[
              { header: 'Name', render: (d: Department) => d.name },
              { header: 'Code', render: (d: Department) => d.code },
            ]}
          />
        )}
        {!loading && tab === 'courses' && (
          <SimpleTable
            rows={courses}
            empty="No courses yet"
            columns={[
              { header: 'Name', render: (c: Course) => c.name },
              { header: 'Code', render: (c: Course) => c.code },
              { header: 'Department', render: (c: Course) => c.department?.name },
            ]}
          />
        )}
        {!loading && tab === 'subjects' && (
          <SimpleTable
            rows={subjects}
            empty="No subjects yet"
            columns={[
              { header: 'Name', render: (s: Subject) => s.name },
              { header: 'Code', render: (s: Subject) => s.code },
              { header: 'Course', render: (s: Subject) => s.course?.name },
            ]}
          />
        )}
      </Card>

      <AcademicsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tab={tab}
        departments={departments}
        courses={courses}
        onCreated={load}
      />
    </div>
  );
}

function SimpleTable<T extends { id: string }>({
  rows,
  columns,
  empty,
}: {
  rows: T[];
  columns: { header: string; render: (row: T) => React.ReactNode }[];
  empty: string;
}) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-[var(--border)] text-xs uppercase text-muted">
          {columns.map((c) => (
            <th key={c.header} className="py-2">
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
            {columns.map((c) => (
              <td key={c.header} className="py-2.5">
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AcademicsModal({
  open,
  onClose,
  tab,
  departments,
  courses,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  tab: Tab;
  departments: Department[];
  courses: Course[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ name: '', code: '', departmentId: '', courseId: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      if (tab === 'departments') await api.post('/departments', { name: form.name, code: form.code });
      else if (tab === 'courses') await api.post('/courses', { name: form.name, code: form.code, departmentId: form.departmentId });
      else await api.post('/subjects', { name: form.name, code: form.code, courseId: form.courseId });
      setForm({ name: '', code: '', departmentId: '', courseId: '' });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Add ${tab === 'departments' ? 'Department' : tab === 'courses' ? 'Course' : 'Subject'}`}>
      <div className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label>Code</Label>
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>
        {tab === 'courses' && (
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
        )}
        {tab === 'subjects' && (
          <div>
            <Label>Course</Label>
            <Select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Button className="w-full" loading={saving} onClick={submit}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
