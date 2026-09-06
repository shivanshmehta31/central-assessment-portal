import { LoginForm } from '@/components/auth/login-form';

export default function FacultyLoginPage() {
  return (
    <LoginForm
      role="FACULTY"
      identifierLabel="Faculty Email"
      identifierPlaceholder="faculty@institution.edu"
      accent="#0f766e"
      title="Faculty Portal"
    />
  );
}
