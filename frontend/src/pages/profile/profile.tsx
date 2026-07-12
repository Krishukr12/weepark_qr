import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Mail, Phone } from 'lucide-react';
import { authApi } from '@/api/auth.api';
import { getApiErrorMessage } from '@/lib/api';
import { getInitials } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { FormField } from '@/components/shared/form-field';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const profileSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  phone: z.string().or(z.literal('')),
  photoUrl: z.string().url('Enter a valid URL').or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Organization Admin',
  VALET: 'Valet',
  EMPLOYEE: 'Employee',
};

export function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      name: user?.name ?? '',
      phone: user?.phone ?? '',
      photoUrl: user?.photoUrl ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ProfileForm) =>
      authApi.updateProfile({
        name: values.name,
        phone: values.phone || null,
        photoUrl: values.photoUrl || null,
      }),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Profile updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your personal information." />

      <Card>
        <CardContent className="flex flex-col items-start gap-5 pt-6 sm:flex-row sm:items-center">
          <Avatar className="size-20 text-xl">
            {user.photoUrl ? <AvatarImage src={user.photoUrl} alt={user.name} /> : null}
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">{user.name}</h2>
              <Badge variant="success">
                <BadgeCheck /> {roleLabels[user.role]}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" /> {user.email}
              </span>
              {user.phone ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" /> {user.phone}
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit profile</CardTitle>
          <CardDescription>Email changes require an administrator.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="grid max-w-xl gap-4">
            <FormField label="Full name" htmlFor="p-name" error={form.formState.errors.name?.message} required>
              <Input id="p-name" {...form.register('name')} />
            </FormField>
            <FormField label="Phone" htmlFor="p-phone" error={form.formState.errors.phone?.message}>
              <Input id="p-phone" placeholder="+91 98765 43210" {...form.register('phone')} />
            </FormField>
            <FormField label="Photo URL" htmlFor="p-photo" error={form.formState.errors.photoUrl?.message}>
              <Input id="p-photo" placeholder="https://…" {...form.register('photoUrl')} />
            </FormField>
            <div>
              <Button type="submit" loading={mutation.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
