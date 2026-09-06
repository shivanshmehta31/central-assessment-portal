'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Input, Label } from '@/components/ui/primitives';

export function ForgotPasswordForm({ role, backHref }: { role: string; backHref: string }) {
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { identifier });
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eef2ff,_#f6f7fb_60%)] px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-lg font-semibold">{role} Password Reset</h1>
        <p className="mb-6 text-center text-sm text-muted">We&apos;ll send reset instructions if the account exists.</p>

        {sent ? (
          <div className="card p-6 text-center text-sm">
            If an account matches those details, password reset instructions have been sent. Contact your
            administrator if you don&apos;t receive anything shortly.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card space-y-4 p-6">
            <div>
              <Label>Email or ID</Label>
              <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
            </div>
            <Button type="submit" className="w-full" loading={loading} size="lg">
              Send reset instructions
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted">
          <Link href={backHref} className="hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
