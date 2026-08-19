import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Plus, Power, UserCog } from 'lucide-react';
import { sitesApi, valetsApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { valetSchema, type ValetForm } from '@/lib/form-schemas';
import { getInitials } from '@/lib/utils';
import { useListState } from '@/hooks/use-list-state';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { SearchInput } from '@/components/shared/search-input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ActiveBadge } from '@/components/shared/status-badge';
import { FormField } from '@/components/shared/form-field';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Valet } from '@/types';

function ValetFormDialog({ open, onOpenChange, valet }: { open: boolean; onOpenChange: (open: boolean) => void; valet: Valet | null }) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(valet);

  const { data: sites } = useQuery({
    queryKey: ['sites', 'all-options'],
    queryFn: () => sitesApi.list({ page: 1, limit: 100 }),
    enabled: open,
  });

  const form = useForm<ValetForm>({
    resolver: zodResolver(valetSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', photoUrl: '', siteIds: [] },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: valet?.name ?? '',
        email: valet?.email ?? '',
        phone: valet?.phone ?? '',
        password: '',
        photoUrl: valet?.photoUrl ?? '',
        siteIds: valet?.valetAssignments.map((a) => a.site.id) ?? [],
      });
    }
  }, [open, valet, form]);

  const mutation = useMutation({
    mutationFn: (values: ValetForm) => {
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone,
        photoUrl: values.photoUrl || null,
        siteIds: values.siteIds,
        ...(values.password && !isEditing ? { password: values.password } : {}),
      };
      return isEditing && valet ? valetsApi.update(valet.id, payload) : valetsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Valet updated' : 'Valet created — credentials emailed');
      void queryClient.invalidateQueries({ queryKey: ['valets'] });
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const selectedSiteIds = form.watch('siteIds');

  const toggleSite = (siteId: string) => {
    const current = form.getValues('siteIds');
    form.setValue(
      'siteIds',
      current.includes(siteId) ? current.filter((id) => id !== siteId) : [...current, siteId],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit valet' : 'Create valet'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update valet details and site assignments.'
              : 'Login credentials are emailed automatically. Leave password blank to auto-generate one.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name" htmlFor="v-name" error={form.formState.errors.name?.message} required>
              <Input id="v-name" placeholder="Ravi Kumar" {...form.register('name')} />
            </FormField>
            <FormField label="Phone" htmlFor="v-phone" error={form.formState.errors.phone?.message} required>
              <Input id="v-phone" placeholder="+91 98765 43210" {...form.register('phone')} />
            </FormField>
          </div>
          <FormField label="Email" htmlFor="v-email" error={form.formState.errors.email?.message} required>
            <Input id="v-email" type="email" placeholder="valet@weepark.io" disabled={isEditing} {...form.register('email')} />
          </FormField>
          {!isEditing ? (
            <FormField label="Password (optional)" htmlFor="v-password" error={form.formState.errors.password?.message}>
              <Input id="v-password" type="password" placeholder="Auto-generated if left blank" {...form.register('password')} />
            </FormField>
          ) : null}
          <FormField label="Photo URL (optional)" htmlFor="v-photo" error={form.formState.errors.photoUrl?.message}>
            <Input id="v-photo" placeholder="https://…" {...form.register('photoUrl')} />
          </FormField>
          <FormField label="Assigned sites" error={undefined}>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl border p-3 scrollbar-thin">
              {sites?.data.length ? (
                sites.data.map((site) => {
                  const selected = selectedSiteIds.includes(site.id);
                  return (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => toggleSite(site.id)}
                      className={
                        selected
                          ? 'rounded-full border border-brand bg-brand/12 px-3 py-1 text-xs font-medium text-brand transition-colors'
                          : 'rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground'
                      }
                    >
                      {site.name}
                    </button>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No sites available yet.</p>
              )}
            </div>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEditing ? 'Save changes' : 'Create valet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ValetsPage() {
  const queryClient = useQueryClient();
  const { search, setSearch, setPage, params } = useListState();
  const [formOpen, setFormOpen] = useState(false);
  const [editingValet, setEditingValet] = useState<Valet | null>(null);
  const [deactivating, setDeactivating] = useState<Valet | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['valets', params],
    queryFn: () => valetsApi.list(params),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => valetsApi.deactivate(id),
    onSuccess: () => {
      toast.success('Valet deactivated');
      void queryClient.invalidateQueries({ queryKey: ['valets'] });
      setDeactivating(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const reactivate = useMutation({
    mutationFn: (valet: Valet) => valetsApi.update(valet.id, { isActive: true }),
    onSuccess: () => {
      toast.success('Valet activated');
      void queryClient.invalidateQueries({ queryKey: ['valets'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Column<Valet>[] = [
    {
      key: 'valet',
      header: 'Valet',
      render: (valet) => (
        <div className="flex items-center gap-3">
          <Avatar>
            {valet.photoUrl ? <AvatarImage src={valet.photoUrl} alt={valet.name} /> : null}
            <AvatarFallback>{getInitials(valet.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{valet.name}</p>
            <p className="text-xs text-muted-foreground">{valet.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (valet) => valet.phone ?? '—' },
    {
      key: 'sites',
      header: 'Sites',
      render: (valet) => (
        <div className="flex max-w-64 flex-wrap gap-1">
          {valet.valetAssignments.length === 0 ? (
            <span className="text-xs text-muted-foreground">Unassigned</span>
          ) : (
            valet.valetAssignments.slice(0, 3).map((assignment) => (
              <Badge key={assignment.id} variant="secondary" className="text-xs">
                {assignment.site.name}
              </Badge>
            ))
          )}
          {valet.valetAssignments.length > 3 ? (
            <Badge variant="outline" className="text-xs">+{valet.valetAssignments.length - 3}</Badge>
          ) : null}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (valet) => <ActiveBadge isActive={valet.isActive} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (valet) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditingValet(valet); setFormOpen(true); }}>
              <Pencil /> Edit & assign sites
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {valet.isActive ? (
              <DropdownMenuItem variant="destructive" onClick={() => setDeactivating(valet)}>
                <Power /> Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => reactivate.mutate(valet)}>
                <Power /> Activate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Valets"
        description="Manage valets and their site assignments."
        actions={
          <Button onClick={() => { setEditingValet(null); setFormOpen(true); }}>
            <Plus /> New valet
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(valet) => valet.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle="No valets yet"
        emptyDescription="Create valets and assign them to parking sites."
        emptyAction={
          <Button onClick={() => { setEditingValet(null); setFormOpen(true); }}>
            <Plus /> Create valet
          </Button>
        }
        toolbar={
          <div className="flex items-center justify-between gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search valets…" />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <UserCog className="size-4" />
              {data?.meta.total ?? 0} valets
            </div>
          </div>
        }
      />

      <ValetFormDialog open={formOpen} onOpenChange={setFormOpen} valet={editingValet} />
      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={`Deactivate ${deactivating?.name}?`}
        description="The valet will no longer be able to sign in or receive pickup requests."
        confirmLabel="Deactivate"
        destructive
        loading={deactivate.isPending}
        onConfirm={() => deactivating && deactivate.mutate(deactivating.id)}
      />
    </div>
  );
}
