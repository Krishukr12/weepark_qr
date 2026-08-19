import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Car, MoreHorizontal, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, vehiclesApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { FUEL_TYPES, VEHICLE_TYPES, vehicleSchema, type VehicleForm } from '@/lib/form-schemas';
import { useListState } from '@/hooks/use-list-state';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { SearchInput } from '@/components/shared/search-input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormField } from '@/components/shared/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FuelType, Vehicle, VehicleType } from '@/types';

function VehicleFormDialog({ open, onOpenChange, vehicle }: { open: boolean; onOpenChange: (open: boolean) => void; vehicle: Vehicle | null }) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(vehicle);

  const { data: employees } = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => employeesApi.list({ page: 1, limit: 100 }),
    enabled: open,
  });

  const form = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicleNumber: '', vehicleType: 'CAR', brand: '', model: '', color: '',
      fuelType: 'PETROL', rcNumber: '', isPrimary: false, employeeId: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        vehicleNumber: vehicle?.vehicleNumber ?? '',
        vehicleType: vehicle?.vehicleType ?? 'CAR',
        brand: vehicle?.brand ?? '',
        model: vehicle?.model ?? '',
        color: vehicle?.color ?? '',
        fuelType: vehicle?.fuelType ?? 'PETROL',
        rcNumber: vehicle?.rcNumber ?? '',
        isPrimary: vehicle?.isPrimary ?? false,
        employeeId: vehicle?.employee.id ?? '',
      });
    }
  }, [open, vehicle, form]);

  const mutation = useMutation({
    mutationFn: (values: VehicleForm) =>
      isEditing && vehicle ? vehiclesApi.update(vehicle.id, values) : vehiclesApi.create(values),
    onSuccess: () => {
      toast.success(isEditing ? 'Vehicle updated' : 'Vehicle registered');
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit vehicle' : 'Register vehicle'}</DialogTitle>
          <DialogDescription>One employee can own multiple vehicles.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Vehicle number" htmlFor="vh-number" error={form.formState.errors.vehicleNumber?.message} required>
              <Input id="vh-number" placeholder="KA01AB1234" className="font-mono uppercase" {...form.register('vehicleNumber')} />
            </FormField>
            <FormField label="Owner (employee)" error={form.formState.errors.employeeId?.message} required>
              <Select
                value={form.watch('employeeId')}
                onValueChange={(value) => form.setValue('employeeId', value)}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.data.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Type" required>
              <Select value={form.watch('vehicleType')} onValueChange={(value) => form.setValue('vehicleType', value as VehicleType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Fuel" required>
              <Select value={form.watch('fuelType')} onValueChange={(value) => form.setValue('fuelType', value as FuelType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Brand" htmlFor="vh-brand" error={form.formState.errors.brand?.message}>
              <Input id="vh-brand" placeholder="Hyundai" {...form.register('brand')} />
            </FormField>
            <FormField label="Model" htmlFor="vh-model" error={form.formState.errors.model?.message}>
              <Input id="vh-model" placeholder="Creta" {...form.register('model')} />
            </FormField>
            <FormField label="Color" htmlFor="vh-color" error={form.formState.errors.color?.message}>
              <Input id="vh-color" placeholder="White" {...form.register('color')} />
            </FormField>
            <FormField label="RC number" htmlFor="vh-rc" error={form.formState.errors.rcNumber?.message}>
              <Input id="vh-rc" placeholder="RC-…" {...form.register('rcNumber')} />
            </FormField>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="vh-primary" checked={form.watch('isPrimary')} onCheckedChange={(checked) => form.setValue('isPrimary', checked)} />
            <label htmlFor="vh-primary" className="text-sm font-medium">
              Primary vehicle
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEditing ? 'Save changes' : 'Register vehicle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VehiclesPage() {
  const queryClient = useQueryClient();
  const { search, setSearch, setPage, params } = useListState();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', params],
    queryFn: () => vehiclesApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vehiclesApi.remove(id),
    onSuccess: () => {
      toast.success('Vehicle deleted');
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setDeleting(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Column<Vehicle>[] = [
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (vehicle) => (
        <div className="flex items-center gap-2">
          <div>
            <p className="flex items-center gap-1.5 font-mono text-sm font-medium">
              {vehicle.vehicleNumber}
              {vehicle.isPrimary ? <Star className="size-3.5 fill-warning text-warning" /> : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {[vehicle.brand, vehicle.model, vehicle.color].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (vehicle) => <Badge variant="secondary">{vehicle.vehicleType}</Badge> },
    { key: 'fuel', header: 'Fuel', render: (vehicle) => <Badge variant="outline">{vehicle.fuelType}</Badge> },
    {
      key: 'owner',
      header: 'Owner',
      render: (vehicle) => (
        <div>
          <p className="text-sm">{vehicle.employee.name}</p>
          <p className="text-xs text-muted-foreground">{vehicle.employee.organization.name}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (vehicle) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditing(vehicle); setFormOpen(true); }}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(vehicle)}>
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
        title="Vehicles"
        description="Registered vehicles across your workforce."
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus /> Register vehicle
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(vehicle) => vehicle.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle="No vehicles yet"
        emptyDescription="Register vehicles for employees, or let them self-register at the QR page."
        emptyAction={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus /> Register vehicle
          </Button>
        }
        toolbar={
          <div className="flex items-center justify-between gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search vehicles…" />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Car className="size-4" />
              {data?.meta.total ?? 0} vehicles
            </div>
          </div>
        }
      />

      <VehicleFormDialog open={formOpen} onOpenChange={setFormOpen} vehicle={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.vehicleNumber}?`}
        description="Vehicles with parking history cannot be deleted."
        confirmLabel="Delete vehicle"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
