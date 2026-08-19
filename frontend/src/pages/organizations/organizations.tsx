import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, MapPin, MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { organizationsApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { orgSchema, type OrgForm } from '@/lib/form-schemas';
import { getInitials } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';
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
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Organization, OrganizationClientType, SiteCapacitySummary } from '@/types';
import { cn } from '@/lib/utils';

function formatOrgNames(orgs: SiteCapacitySummary['occupiedByOrganizations'] | undefined): string {
  const names = (orgs ?? []).map((org) => org.companyName || org.name);
  if (names.length === 0) return 'another organization';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** Why a site cannot be assigned to the org being onboarded. Null means it can be selected. */
function siteAssignmentBlockReason(
  site: SiteCapacitySummary,
  clientType: OrganizationClientType,
  alreadySelected: boolean,
): string | null {
  const others = site.occupiedByOrganizations ?? [];
  const names = formatOrgNames(others);
  const verb = others.length > 1 ? 'are' : 'is';

  if (!alreadySelected && site.occupiedByClientType === 'B2C') {
    if (clientType === 'B2C') {
      return `A B2C client (${names}) is already assigned to this site. Only one B2C organization can use a site.`;
    }
    return `This site is reserved for B2C walk-in parking because ${names} ${verb} already assigned. B2B organizations cannot share it.`;
  }

  if (!alreadySelected && site.occupiedByClientType === 'B2B' && clientType === 'B2C') {
    return `This site is B2B-only because ${names} ${verb} already assigned. B2C organizations cannot share a B2B site.`;
  }

  if (!alreadySelected && site.remaining < 1) {
    return 'This site has no remaining parking spaces.';
  }

  return null;
}

function OrgFormDialog({
  open,
  onOpenChange,
  organization,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization | null;
}) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(organization);

  const { data: capacity, isLoading: capacityLoading } = useQuery({
    queryKey: ['org-site-capacity', organization?.id ?? 'new'],
    queryFn: () => organizationsApi.siteCapacity(organization?.id),
    enabled: open,
  });

  const form = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: '',
      companyName: '',
      gstNumber: '',
      adminName: '',
      adminEmail: '',
      adminPhone: '',
      address: '',
      logoUrl: '',
      clientType: 'B2B',
      siteAllocations: [],
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
        clientType: organization?.clientType ?? 'B2B',
        siteAllocations:
          organization?.siteAssignments?.map((a) => ({
            siteId: a.site.id,
            allocatedSpaces: a.allocatedSpaces,
          })) ?? [],
      });
    }
  }, [open, organization, form]);

  const mutation = useMutation({
    mutationFn: (values: OrgForm) => {
      const payload = {
        name: values.name,
        companyName: values.companyName,
        gstNumber: values.gstNumber,
        adminName: values.adminName,
        adminEmail: values.adminEmail,
        adminPhone: values.adminPhone,
        address: values.address,
        logoUrl: values.logoUrl,
        siteAllocations: values.siteAllocations,
        ...(isEditing ? {} : { clientType: values.clientType }),
      };
      return isEditing && organization
        ? organizationsApi.update(organization.id, payload)
        : organizationsApi.create(payload);
    },
    onSuccess: () => {
      toast.success(
        isEditing ? 'Organization updated' : 'Organization onboarded — login credentials emailed to the admin',
      );
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['org-site-capacity'] });
      onOpenChange(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const siteAllocations = form.watch('siteAllocations');
  const clientType = form.watch('clientType');
  const totalAllocated = useMemo(
    () => siteAllocations.reduce((sum, a) => sum + (Number(a.allocatedSpaces) || 0), 0),
    [siteAllocations],
  );

  const capacityBySite = useMemo(() => {
    const map = new Map<string, NonNullable<typeof capacity>[number]>();
    capacity?.forEach((c) => map.set(c.siteId, c));
    return map;
  }, [capacity]);

  useEffect(() => {
    if (!capacity?.length) return;
    const current = form.getValues('siteAllocations');
    const allowed = current.filter((allocation) => {
      const site = capacityBySite.get(allocation.siteId);
      if (!site) return true;
      return siteAssignmentBlockReason(site, clientType, false) === null;
    });
    if (allowed.length !== current.length) {
      form.setValue('siteAllocations', allowed, { shouldValidate: true });
    }
  }, [capacity, capacityBySite, clientType, form]);

  const toggleSite = (siteId: string, remaining: number, blocked: string | null) => {
    const current = form.getValues('siteAllocations');
    const exists = current.find((a) => a.siteId === siteId);
    if (exists) {
      form.setValue(
        'siteAllocations',
        current.filter((a) => a.siteId !== siteId),
        { shouldValidate: true },
      );
      return;
    }
    if (blocked) {
      toast.error(blocked);
      return;
    }
    if (remaining < 1) {
      toast.error('This site has no remaining capacity');
      return;
    }
    form.setValue(
      'siteAllocations',
      [...current, { siteId, allocatedSpaces: Math.min(1, remaining) }],
      { shouldValidate: true },
    );
  };

  const setSpaces = (siteId: string, value: number, max: number) => {
    const current = form.getValues('siteAllocations');
    form.setValue(
      'siteAllocations',
      current.map((a) =>
        a.siteId === siteId
          ? { ...a, allocatedSpaces: Math.max(1, Math.min(max, Number.isFinite(value) ? value : 1)) }
          : a,
      ),
      { shouldValidate: true },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit organization' : 'Onboard organization'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update organization details and per-site parking allocations.'
              : 'An admin login is created automatically. Assign sites and spaces below.'}
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
            <FormField label="Client type" error={form.formState.errors.clientType?.message} required>
              <div className="grid grid-cols-2 gap-2">
                {(['B2B', 'B2C'] as const).map((type) => {
                  const selected = form.watch('clientType') === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={isEditing}
                      onClick={() => form.setValue('clientType', type, { shouldValidate: true })}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                        selected ? 'border-brand/40 bg-brand/5 font-medium' : 'border-border hover:bg-muted/50',
                        isEditing && 'cursor-not-allowed opacity-70',
                      )}
                    >
                      <span className="block">{type}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {type === 'B2B' ? 'Employees and registered vehicles' : 'Walk-in guests: plate + phone'}
                      </span>
                    </button>
                  );
                })}
              </div>
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

          <FormField
            label="Site allocations"
            error={form.formState.errors.siteAllocations?.message ?? form.formState.errors.siteAllocations?.root?.message}
          >
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
              {capacityLoading ? (
                <p className="text-sm text-muted-foreground">Loading site capacity…</p>
              ) : capacity?.length ? (
                capacity.map((site) => {
                  const allocation = siteAllocations.find((a) => a.siteId === site.siteId);
                  const selected = Boolean(allocation);
                  const maxForThisOrg = site.remaining;
                  const overLimit = selected && (allocation?.allocatedSpaces ?? 0) > maxForThisOrg;
                  const blocked = siteAssignmentBlockReason(site, clientType, selected);

                  const row = (
                    <div
                      className={cn(
                        'rounded-lg border px-3 py-2.5 transition-colors',
                        selected ? 'border-brand/40 bg-brand/5' : 'border-transparent hover:bg-muted/50',
                        blocked && 'cursor-not-allowed opacity-50 hover:bg-transparent',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={Boolean(blocked)}
                          onChange={() => toggleSite(site.siteId, site.remaining, blocked)}
                          className="mt-1 size-4 rounded border-border disabled:cursor-not-allowed"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{site.siteName}</p>
                              <p className="text-xs text-muted-foreground">
                                {site.siteCode} · capacity {site.totalCapacity} ·{' '}
                                {site.allocatedToOthers} taken by others ·{' '}
                                <span className={site.remaining > 0 ? 'text-brand' : 'text-destructive'}>
                                  {site.remaining} left
                                </span>
                              </p>
                            </div>
                            {selected ? (
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-muted-foreground">Spaces</label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={maxForThisOrg}
                                  className="h-8 w-20"
                                  value={allocation?.allocatedSpaces ?? 1}
                                  onChange={(e) => setSpaces(site.siteId, Number(e.target.value), maxForThisOrg)}
                                />
                              </div>
                            ) : null}
                          </div>
                          {overLimit ? (
                            <p className="mt-1 text-xs text-destructive">
                              Only {maxForThisOrg} space{maxForThisOrg === 1 ? '' : 's'} available on this site.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );

                  if (!blocked) return <div key={site.siteId}>{row}</div>;

                  return (
                    <Tooltip key={site.siteId}>
                      <TooltipTrigger asChild>
                        <div>{row}</div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="z-[80] max-w-xs whitespace-normal text-left leading-relaxed">
                        {blocked}
                      </TooltipContent>
                    </Tooltip>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No active sites available. Create a site first.</p>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Employees can only park at assigned sites, within the spaces you allocate. B2C sites accept walk-in guests instead of employee registration.</span>
              <span className="font-medium text-foreground tabular-nums">Total allocated: {totalAllocated}</span>
            </div>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={mutation.isPending}
              disabled={siteAllocations.some((a) => {
                const remaining = capacityBySite.get(a.siteId)?.remaining ?? 0;
                return a.allocatedSpaces > remaining;
              })}
            >
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
  const [searchParams] = useSearchParams();
  const highlightOrgId = searchParams.get('highlight');

  const { data, isLoading } = useQuery({
    queryKey: ['organizations', params],
    queryFn: () => organizationsApi.list(params),
  });

  const highlightedOrg = useQuery({
    queryKey: ['organizations', highlightOrgId],
    queryFn: () => organizationsApi.get(highlightOrgId!),
    enabled: Boolean(highlightOrgId),
  });

  const rows = useMemo(() => {
    const items = data?.data ?? [];
    const extra = highlightedOrg.data;
    if (!extra) return items;
    if (items.some((row) => row.id === extra.id)) return items;
    return [extra, ...items];
  }, [data?.data, highlightedOrg.data]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => organizationsApi.remove(id),
    onSuccess: () => {
      toast.success('Organization deleted');
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['org-site-capacity'] });
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
            <Badge variant={org.clientType === 'B2C' ? 'info' : 'outline'} className="mt-1">
              {org.clientType}
            </Badge>
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
    {
      key: 'sites',
      header: 'Sites',
      render: (org) => (
        <div className="flex flex-wrap gap-1">
          {org.siteAssignments?.length ? (
            org.siteAssignments.map((a) => (
              <Badge key={a.id} variant="outline" className="gap-1">
                <MapPin className="size-3" />
                {a.site.name}
                <span className="tabular-nums text-muted-foreground">· {a.allocatedSpaces}</span>
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No sites assigned</span>
          )}
        </div>
      ),
    },
    { key: 'allocation', header: 'Total spaces', render: (org) => <span className="tabular-nums">{org.parkingAllocation}</span> },
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
        description="Onboard organizations and allocate parking spaces per site."
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus /> Onboard organization
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(org) => org.id}
        highlightedRowKey={highlightOrgId}
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
