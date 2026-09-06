'use client';

import { LayoutDashboard, ClipboardCheck } from 'lucide-react';
import { PortalShell } from '@/components/layout/portal-shell';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { LoadingBlock } from '@/components/ui/primitives';

const navItems = [
  { label: 'Dashboard', href: '/faculty/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Evaluate Submissions', href: '/faculty/evaluate', icon: <ClipboardCheck size={18} /> },
];

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireAuth('FACULTY');
  if (!ready) return <LoadingBlock label="Verifying session..." />;

  return (
    <PortalShell navItems={navItems} roleLabel="Faculty" accentLabel="Faculty Portal">
      {children}
    </PortalShell>
  );
}
