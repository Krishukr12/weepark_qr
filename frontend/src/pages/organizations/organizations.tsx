import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { organizationsApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { getInitials } from '@/lib/utils';
import { useListState } from '@/hooks/use-list-state';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { SearchInput } from '@/components/shared/search-input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ActiveBadge } from '@/components/shared/status-badge';
import { FormField } from '@/components/shared/form-field';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Organization } from '@/types';

const orgSchema = z.object({
  name: z.string().min(2, 'Organization name is too short'),
  companyName: z.string().min(2, 'Company name is too short'),
  gstNumber: z.string().or(z.literal('')),
  adminName: z.string().min(2, 'Admin name is too short'),
  adminEmail: z.string().email('Enter a valid email'),
  adminPhone: z.string().or(z.literal('')),
  address: z.string().or(z.literal('')),
  logoUrl: z.string().url('Enter a valid URL').or(z.literal('')),
  parkingAllocation: z.coerce.number<number>().int().min(0, 'Cannot be negative'),
});

type OrgForm = z.infer<typeof orgSchema>;

function OrgFormDialog({ open, onOpenChange, organization }: { open: boolean; onOpenChange: (open: boolean) => void; organization: Organization | null }) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(organization);

  const form = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: '', companyName: '', gstNumber: '', adminName: '', adminEmail: '',
      adminPhone: '', address: '', logoUrl: '', parkingAllocation: 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: organization?.name ?? '',
        companyName: organization?.companyName ?? '',
        gstNumber: organization?.gstNumber ?? '',
        adminName: organization?.adminName ?? '',
        adminEmail: organization?.adminEmail ?? '',
        adminPhone: organization?.adminPhone ?? '',
        address: organization?.address ?? '',
        logoUrl: organization?.logoUrl ?? '',
        parkingAllocation: organization?.parkingAllocation ?? 0,
      });
    }
  }, [open, organization, form]);

  const mutation = useMutation({
    mutationFn: (values: OrgForm) =>
      isEditing && organization
        ? organizationsApi.update(organization.id, values)
        : organizationsApi.create(values),
    onSuccess: () => {
      toast.success(
        isEditing ? 'Organization updated' : 'Organization onboarded — login credentials emailed to the admin',
      );
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit organization' : 'Onboard organization'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update organization details.'
              : 'An admin login is created automatically and credentials are emailed to the admin.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Organization name" htmlFor="o-name" error={form.formState.errors.name?.message} required>
              <Input id="o-name" placeholder="Acme India" {...form.register('name')} />
            </FormField>
            <FormField label="Company name" htmlFor="o-company" error={form.formState.errors.companyName?.message} required>
              <Input id="o-company" placeholder="Acme Technologies Pvt Ltd" {...form.register('companyName')} />
            </FormField>
            <FormField label="GST number" htmlFor="o-gst" error={form.formState.errors.gstNumber?.message}>
              <Input id="o-gst" placeholder="29ABCDE1234F1Z5" {...form.register('gstNumber')} />
            </FormField>
            <FormField label="Parking space allocation" htmlFor="o-allocation" error={form.formState.errors.parkingAllocation?.message} required>
              <Input id="o-allocation" type="number" min={0} {...form.register('parkingAllocation')} />
            </FormField>
            <FormField label="Admin name" htmlFor="o-admin" error={form.formState.errors.adminName?.message} required>
              <Input id="o-admin" placeholder="Priya Sharma" {...form.register('adminName')} />
            </FormField>
            <FormField label="Admin email" htmlFor="o-email" error={form.formState.errors.adminEmail?.message} required>
              <Input id="o-email" type="email" placeholder="admin@acme.com" disabled={isEditing} {...form.register('adminEmail')} />
            </FormField>
            <FormField label="Admin phone" htmlFor="o-phone" error={form.formState.errors.adminPhone?.message}>
              <Input id="o-phone" placeholder="+91 98765 43210" {...form.register('adminPhone')} />
            </FormField>
            <FormField label="Logo URL" htmlFor="o-logo" error={form.formState.errors.logoUrl?.message}>
              <Input id="o-logo" placeholder="https://…" {...form.register('logoUrl')} />
            </FormField>
          </div>
          <FormField label="Address" htmlFor="o-address" error={form.formState.errors.address?.message}>
            <Textarea id="o-address" rows={2} placeholder="Registered office address" {...form.register('address')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEditing ? 'Save changes' : 'Onboard organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrganizationsPage() {
  const queryClient = useQueryClient();
  const { search, setSearch, setPage, params } = useListState();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState<Organization | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['organizations', params],
    queryFn: () => organizationsApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => organizationsApi.remove(id),
    onSuccess: () => {
      toast.success('Organization deleted');
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const toggleActive = useMutation({
    mutationFn: (org: Organization) => organizationsApi.update(org.id, { isActive: !org.isActive }),
    onSuccess: (_, org) => {
      toast.success(org.isActive ? 'Organization deactivated' : 'Organization activated');
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Column<Organization>[] = [
    {
      key: 'org',
      header: 'Organization',
      render: (org) => (
        <div className="flex items-center gap-3">
          <Avatar className="rounded-xl">
            {org.logoUrl ? <AvatarImage src={org.logoUrl} alt={org.name} /> : null}
            <AvatarFallback className="rounded-xl">{getInitials(org.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{org.name}</p>
            <p className="text-xs text-muted-foreground">{org.companyName}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'admin',
      header: 'Admin',
      render: (org) => (
        <div>
          <p className="text-sm">{org.adminName}</p>
          <p className="text-xs text-muted-foreground">{org.adminEmail}</p>
        </div>
      ),
    },
    { key: 'employees', header: 'Employees', render: (org) => <span className="tabular-nums">{org._count?.employees ?? 0}</span> },
    { key: 'parkings', header: 'Parkings', render: (org) => <span className="tabular-nums">{org._count?.parkingEntries ?? 0}</span> },
    { key: 'allocation', header: 'Allocation', render: (org) => <span className="tabular-nums">{org.parkingAllocation}</span> },
    { key: 'status', header: 'Status', render: (org) => <ActiveBadge isActive={org.isActive} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (org) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditing(org); setFormOpen(true); }}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleActive.mutate(org)}>
              <Power /> {org.isActive ? 'Deactivate' : 'Activate'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(org)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Onboard organizations and manage their parking allocations."
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus /> Onboard organization
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(org) => org.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle="No organizations yet"
        emptyDescription="Onboard your first organization — admin credentials are emailed automatically."
        emptyAction={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus /> Onboard organization
          </Button>
        }
        toolbar={
          <div className="flex items-center justify-between gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search organizations…" />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="size-4" />
              {data?.meta.total ?? 0} organizations
            </div>
          </div>
        }
      />

      <OrgFormDialog open={formOpen} onOpenChange={setFormOpen} organization={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="This removes the organization, its employees and vehicles. Organizations with actively parked vehicles cannot be deleted."
        confirmLabel="Delete organization"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
