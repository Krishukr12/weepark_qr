import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { KeyRound, Laptop, Monitor, Moon, ShieldCheck, Sun, Trash2 } from 'lucide-react';
import { authApi } from '@/api/auth.api';
import { getApiErrorMessage } from '@/lib/api';
import { useTheme } from '@/context/theme-context';
import { PageHeader } from '@/components/shared/page-header';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const sessions = useQuery({ queryKey: ['sessions'], queryFn: authApi.sessions });

  const changePassword = useMutation({
    mutationFn: (values: PasswordForm) => authApi.changePassword(values.currentPassword, values.newPassword),
    onSuccess: (message) => {
      toast.success(message);
      form.reset();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const revokeSession = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      toast.success('Session revoked');
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Appearance, security and active sessions." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose how WeePark looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={cn(
                  'flex w-32 flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all',
                  theme === option.value
                    ? 'border-brand bg-brand/8 text-brand shadow-xs'
                    : 'text-muted-foreground hover:border-foreground/25 hover:text-foreground',
                )}
              >
                <option.icon className="size-5" />
                {option.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4.5 text-brand" /> Change password
          </CardTitle>
          <CardDescription>Use a strong password you don't use elsewhere.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((values) => changePassword.mutate(values))}
            className="grid max-w-xl gap-4 sm:grid-cols-3"
          >
            <FormField label="Current password" htmlFor="s-current" error={form.formState.errors.currentPassword?.message} required>
              <Input id="s-current" type="password" autoComplete="current-password" {...form.register('currentPassword')} />
            </FormField>
            <FormField label="New password" htmlFor="s-new" error={form.formState.errors.newPassword?.message} required>
              <Input id="s-new" type="password" autoComplete="new-password" {...form.register('newPassword')} />
            </FormField>
            <FormField label="Confirm password" htmlFor="s-confirm" error={form.formState.errors.confirmPassword?.message} required>
              <Input id="s-confirm" type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
            </FormField>
            <div className="sm:col-span-3">
              <Button type="submit" loading={changePassword.isPending}>
                Update password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4.5 text-brand" /> Active sessions
          </CardTitle>
          <CardDescription>Devices currently signed in to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : sessions.data && sessions.data.length > 0 ? (
            sessions.data.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl border p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Laptop className="size-4.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{session.userAgent ?? 'Unknown device'}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.ipAddress ?? 'Unknown IP'} · Signed in {format(new Date(session.createdAt), 'dd MMM yyyy, HH:mm')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => revokeSession.mutate(session.id)}
                  aria-label="Revoke session"
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No active sessions.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
