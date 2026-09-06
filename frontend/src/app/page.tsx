import Link from 'next/link';
import { ShieldCheck, GraduationCap, Users2 } from 'lucide-react';

const portals = [
  {
    role: 'Student',
    href: '/student/login',
    icon: GraduationCap,
    description: 'Take assigned assessments, track progress, and view published results.',
  },
  {
    role: 'Faculty',
    href: '/faculty/login',
    icon: Users2,
    description: 'Evaluate submissions, manage assigned assessments, and review performance.',
  },
  {
    role: 'Administrator',
    href: '/admin/login',
    icon: ShieldCheck,
    description: 'Manage the institution, question banks, assessments, and live monitoring.',
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_#eef2ff,_#f6f7fb_60%)] px-6 py-16">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-bold text-white">
          CA
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Central Assessment &amp; Examination Portal</h1>
          <p className="text-sm text-muted">Secure Assessment Platform for Data Visualization Using Python</p>
        </div>
      </div>

      <div className="grid w-full max-w-4xl gap-5 sm:grid-cols-3">
        {portals.map(({ role, href, icon: Icon, description }) => (
          <Link
            key={role}
            href={href}
            className="card group flex flex-col gap-4 p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[var(--primary)] transition group-hover:bg-[var(--primary)] group-hover:text-white">
              <Icon size={22} />
            </div>
            <div>
              <p className="font-semibold text-foreground">{role} Portal</p>
              <p className="mt-1 text-sm text-muted">{description}</p>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-xs text-muted">
        Institution-managed access only. Contact your administrator if you do not have credentials.
      </p>
    </div>
  );
}
