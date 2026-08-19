import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { getApiErrorMessage } from '@/lib/api';
import { loginSchema, type LoginForm } from '@/lib/form-schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { AuthLayout } from './auth-layout';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
      toast.success('Welcome back!');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <AuthLayout title="Sign in" description="Welcome back — sign in to your WeePark workspace.">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message} required>
          <Input id="email" type="email" placeholder="you@company.com" autoComplete="email" {...form.register('email')} />
        </FormField>
        <FormField label="Password" htmlFor="password" error={form.formState.errors.password?.message} required>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              className="pr-10"
              {...form.register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </FormField>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
