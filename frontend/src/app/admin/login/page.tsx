import { LoginForm } from '@/components/auth/login-form';

export default function AdminLoginPage() {
  return (
    <LoginForm
      role="ADMIN"
      identifierLabel="Admin Email"
      identifierPlaceholder="admin@institution.edu"
      accent="#1e3a8a"
      title="Admin Control Center"
    />
  );
}
