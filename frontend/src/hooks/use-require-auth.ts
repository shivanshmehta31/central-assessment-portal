'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import type { UserRole } from '@/lib/types';

export function useRequireAuth(role: UserRole) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!accessToken || !user || user.role !== role) {
      router.replace(`/${role.toLowerCase()}/login`);
      return;
    }
    setReady(true);
  }, [hasHydrated, accessToken, user, role, router]);

  return { user, ready };
}
