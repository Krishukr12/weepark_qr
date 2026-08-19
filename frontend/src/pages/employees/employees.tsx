import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { employeesApi, organizationsApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { employeeSchema, type EmployeeForm } from '@/lib/form-schemas';
import { getInitials } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useListState } from '@/hooks/use-list-state';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { SearchInput } from '@/components/shared/search-input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ActiveBadge } from '@/components/shared/status-badge';
import { FormField } from '@/components/shared/form-field';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Employee } from '@/types';

function EmployeeFormDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (open: boolean) => void; employee: Employee | null }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = Boolean(employee);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: orgs } = useQuery({
    queryKey: ['organizations', 'options', 'B2B'],
    queryFn: () => organizationsApi.list({ page: 1, limit: 100, clientType: 'B2B' }),
    enabled: open && isSuperAdmin,
  });

  const form = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { employeeCode: '', name: '', department: '', designation: '', phone: '', email: '', organizationId: undefined },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        employeeCode: employee?.employeeCode ?? '',
        name: employee?.name ?? '',
        department: employee?.department ?? '',
        designation: employee?.designation ?? '',
        phone: employee?.phone ?? '',
        email: employee?.email ?? '',
        organizationId: employee?.organizationId ?? undefined,
      });
    }
  }, [open, employee, form]);

  const mutation = useMutation({
    mutationFn: (values: EmployeeForm) =>
      isEditing && employee ? employeesApi.update(employee.id, values) : employeesApi.create(values),
    onSuccess: () => {
      toast.success(isEditing ? 'Employee updated' : 'Employee created');
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit employee' : 'Add employee'}</DialogTitle>
          <DialogDescription>Employees can register vehicles and park via site QR codes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Employee ID" htmlFor="e-code" error={form.formState.errors.employeeCode?.message} required>
              <Input id="e-code" placeholder="EMP-1024" {...form.register('employeeCode')} />
            </FormField>
            <FormField label="Name" htmlFor="e-name" error={form.formState.errors.name?.message} required>
              <Input id="e-name" placeholder="Arjun Mehta" {...form.register('name')} />
            </FormField>
            <FormField label="Department" htmlFor="e-dept" error={form.formState.errors.department?.message}>
              <Input id="e-dept" placeholder="Engineering" {...form.register('department')} />
            </FormField>
            <FormField label="Designation" htmlFor="e-desig" error={form.formState.errors.designation?.message}>
              <Input id="e-desig" placeholder="Senior Engineer" {...form.register('designation')} />
            </FormField>
            <FormField label="Phone" htmlFor="e-phone" error={form.formState.errors.phone?.message}>
              <Input id="e-phone" placeholder="+91 98765 43210" {...form.register('phone')} />
            </FormField>
            <FormField label="Email" htmlFor="e-email" error={form.formState.errors.email?.message} required>
              <Input id="e-email" type="email" placeholder="arjun@acme.com" {...form.register('email')} />
            </FormField>
          </div>
          {isSuperAdmin && !isEditing ? (
            <FormField label="Organization" error={form.formState.errors.organizationId?.message} required>
              <Select
                value={form.watch('organizationId') ?? ''}
                onValueChange={(value) => form.setValue('organizationId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {orgs?.data
                    .filter((org) => org.clientType === 'B2B' && org.isActive)
                    .map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEditing ? 'Save changes' : 'Add employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { search, setSearch, setPage, params } = useListState();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', params],
    queryFn: () => employeesApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesApi.remove(id),
    onSuccess: () => {
      toast.success('Employee deleted');
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Column<Employee>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (employee) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{employee.name}</p>
            <p className="text-xs text-muted-foreground">{employee.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'ID', render: (employee) => <Badge variant="outline" className="font-mono">{employee.employeeCode}</Badge> },
    ...(user?.role === 'SUPER_ADMIN'
      ? [{ key: 'org', header: 'Organization', render: (employee: Employee) => employee.organization?.name ?? '—' } satisfies Column<Employee>]
      : []),
    {
      key: 'dept',
      header: 'Department',
      render: (employee) => (
        <div>
          <p className="text-sm">{employee.department || '—'}</p>
          {employee.designation ? <p className="text-xs text-muted-foreground">{employee.designation}</p> : null}
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (employee) => employee.phone || '—' },
    { key: 'vehicles', header: 'Vehicles', render: (employee) => <span className="tabular-nums">{employee._count?.vehicles ?? 0}</span> },
    { key: 'status', header: 'Status', render: (employee) => <ActiveBadge isActive={employee.isActive} /> },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (employee) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditing(employee); setFormOpen(true); }}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(employee)}>
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
        title="Employees"
        description="Manage employees who can park via site QR codes."
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus /> Add employee
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(employee) => employee.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle="No employees yet"
        emptyDescription="Add employees so they can register vehicles and park."
        emptyAction={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus /> Add employee
          </Button>
        }
        toolbar={
          <div className="flex items-center justify-between gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search employees…" />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="size-4" />
              {data?.meta.total ?? 0} employees
            </div>
          </div>
        }
      />

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="This removes the employee and their registered vehicles."
        confirmLabel="Delete employee"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
