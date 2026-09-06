import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function Page() {
  return <ForgotPasswordForm role="Admin" backHref="/admin/login" />;
}
