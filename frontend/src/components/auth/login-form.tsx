'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { login, homeForRole } from '@/lib/auth-actions';
import { ApiError } from '@/lib/api';
import { Button, ErrorBanner, Input, Label } from '@/components/ui/primitives';
import type { UserRole } from '@/lib/types';

export function LoginForm({
  role,
  identifierLabel,
  identifierPlaceholder,
  accent,
  title,
}: {
  role: UserRole;
  identifierLabel: string;
  identifierPlaceholder: string;
  accent: string;
  title: string;
}) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(identifier.trim(), password, role);
      router.push(homeForRole(user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eef2ff,_#f6f7fb_60%)] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
            style={{ background: accent }}
          >
            CA
          </div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted">Central Assessment &amp; Examination Portal</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          {error && <ErrorBanner message={error} />}

          <div>
            <Label>{identifierLabel}</Label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={identifierPlaceholder}
              required
              autoFocus
            />
          </div>

          <div>
            <Label>Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link href={`/${role.toLowerCase()}/forgot-password`} className="text-[var(--accent)] hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading} size="lg">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/" className="hover:underline">
            ← Back to portal selection
          </Link>
        </p>
      </div>
    </div>
  );
}
