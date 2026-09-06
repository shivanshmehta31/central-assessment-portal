'use client';

import { usePathname } from 'next/navigation';
import { LayoutDashboard, Award } from 'lucide-react';
import { PortalShell } from '@/components/layout/portal-shell';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { LoadingBlock } from '@/components/ui/primitives';

const navItems = [
  { label: 'Dashboard', href: '/student/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Results', href: '/student/results', icon: <Award size={18} /> },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireAuth('STUDENT');
  const pathname = usePathname();

  // The exam interface renders in fully isolated "secure exam mode" — no sidebar/navigation.
  if (pathname?.startsWith('/student/exam/')) {
    return <>{children}</>;
  }

  if (!ready) return <LoadingBlock label="Verifying session..." />;

  return (
    <PortalShell navItems={navItems} roleLabel="Student" accentLabel="Student Portal">
      {children}
    </PortalShell>
  );
}
