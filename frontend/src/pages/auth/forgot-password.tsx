import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { authApi } from '@/api/auth.api';
import { getApiErrorMessage } from '@/lib/api';
import { forgotPasswordSchema, type ForgotPasswordForm } from '@/lib/form-schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { AuthLayout } from './auth-layout';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await authApi.forgotPassword(values.email);
      setSent(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <AuthLayout title="Forgot password" description="We'll email you a link to reset your password.">
      {sent ? (
        <div className="space-y-5 rounded-2xl border bg-card p-6 text-center shadow-soft">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand/12">
            <MailCheck className="size-6 text-brand" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              If an account exists for that email, a reset link is on its way. It expires in 30 minutes.
            </p>
          </div>
          <Button variant="outline" asChild className="w-full">
            <Link to="/login">
              <ArrowLeft /> Back to sign in
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message} required>
            <Input id="email" type="email" placeholder="you@company.com" autoComplete="email" {...form.register('email')} />
          </FormField>
          <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
            Send reset link
          </Button>
          <Button variant="ghost" asChild className="w-full">
            <Link to="/login">
              <ArrowLeft /> Back to sign in
            </Link>
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
