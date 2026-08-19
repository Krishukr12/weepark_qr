import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { authApi } from '@/api/auth.api';
import { getApiErrorMessage } from '@/lib/api';
import { resetPasswordSchema, type ResetPasswordForm } from '@/lib/form-schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { AuthLayout } from './auth-layout';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const form = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirmPassword: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const message = await authApi.resetPassword(token, values.password);
      toast.success(message);
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <AuthLayout title="Reset password" description="Choose a new password for your account.">
      {token ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="New password" htmlFor="password" error={form.formState.errors.password?.message} required>
            <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
          </FormField>
          <FormField
            label="Confirm password"
            htmlFor="confirmPassword"
            error={form.formState.errors.confirmPassword?.message}
            required
          >
            <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
          </FormField>
          <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
            Reset password
          </Button>
        </form>
      ) : (
        <div className="space-y-4 rounded-2xl border bg-card p-6 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">
            This reset link is invalid or incomplete. Request a new one from the forgot password page.
          </p>
          <Button variant="outline" asChild className="w-full">
            <Link to="/forgot-password">
              <ArrowLeft /> Request new link
            </Link>
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
