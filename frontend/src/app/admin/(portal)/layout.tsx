'use client';

import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Library,
  ClipboardList,
  Radio,
  ShieldAlert,
  Award,
  FileClock,
  Settings,
} from 'lucide-react';
import { PortalShell } from '@/components/layout/portal-shell';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { LoadingBlock } from '@/components/ui/primitives';

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Students', href: '/admin/students', icon: <GraduationCap size={18} /> },
  { label: 'Faculty', href: '/admin/faculty', icon: <Users size={18} /> },
  { label: 'Academics', href: '/admin/academics', icon: <BookOpen size={18} /> },
  { label: 'Question Bank', href: '/admin/question-bank', icon: <Library size={18} /> },
  { label: 'Assessments', href: '/admin/assessments', icon: <ClipboardList size={18} /> },
  { label: 'Live Monitoring', href: '/admin/monitoring', icon: <Radio size={18} /> },
  { label: 'Incident Management', href: '/admin/incidents', icon: <ShieldAlert size={18} /> },
  { label: 'Results', href: '/admin/results', icon: <Award size={18} /> },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: <FileClock size={18} /> },
  { label: 'Settings', href: '/admin/settings', icon: <Settings size={18} /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireAuth('ADMIN');
  if (!ready) return <LoadingBlock label="Verifying session..." />;

  return (
    <PortalShell navItems={navItems} roleLabel="Administrator" accentLabel="Admin Control Center">
      {children}
    </PortalShell>
  );
}
