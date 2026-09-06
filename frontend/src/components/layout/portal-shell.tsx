'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import clsx from 'clsx';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { logout } from '@/lib/auth-actions';

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

export function PortalShell({
  navItems,
  roleLabel,
  accentLabel,
  children,
}: {
  navItems: NavItem[];
  roleLabel: string;
  accentLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-[var(--border)] bg-white">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-bold text-white">
            CA
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Central Assessment</p>
            <p className="text-xs text-muted">{accentLabel}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.label}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-blue-50 text-[var(--primary)]' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
              {user?.name?.charAt(0) ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted">{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-7xl px-6 py-6 lg:px-10 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
