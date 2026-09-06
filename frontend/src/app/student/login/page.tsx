import { LoginForm } from '@/components/auth/login-form';

export default function StudentLoginPage() {
  return (
    <LoginForm
      role="STUDENT"
      identifierLabel="Enrollment Number / Student ID"
      identifierPlaceholder="CSE2026001"
      accent="#4338ca"
      title="Student Portal"
    />
  );
}
