import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, MoreHorizontal, Pencil, Plus, Power, QrCode, Trash2 } from 'lucide-react';
import { sitesApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { downloadBlob } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useListState } from '@/hooks/use-list-state';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { SearchInput } from '@/components/shared/search-input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ActiveBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SiteFormDialog } from './site-form';
import type { Site } from '@/types';

export function SitesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { search, setSearch, setPage, params } = useListState();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deletingSite, setDeletingSite] = useState<Site | null>(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['sites', params],
    queryFn: () => sitesApi.list(params),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sitesApi.remove(id),
    onSuccess: () => {
      toast.success('Site deleted');
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
      setDeletingSite(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const toggleActive = useMutation({
    mutationFn: (site: Site) => sitesApi.update(site.id, { isActive: !site.isActive }),
    onSuccess: (_, site) => {
      toast.success(site.isActive ? 'Site deactivated' : 'Site activated');
      void queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const downloadQr = async (site: Site) => {
    try {
      const blob = await sitesApi.downloadQr(site.id);
      downloadBlob(blob, `weepark-${site.siteCode}.png`);
      toast.success('QR code downloaded');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const columns: Column<Site>[] = [
    {
      key: 'name',
      header: 'Site',
      render: (site) => (
        <div>
          <p className="font-medium">{site.name}</p>
          <p className="max-w-56 truncate text-xs text-muted-foreground">{site.address}</p>
        </div>
      ),
    },
    {
      key: 'siteCode',
      header: 'Code',
      render: (site) => <Badge variant="outline" className="font-mono">{site.siteCode}</Badge>,
    },
    {
      key: 'occupancy',
      header: 'Occupancy',
      render: (site) =>
        site.occupancy ? (
          <div className="min-w-32">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">
                {site.occupancy.occupied}/{site.occupancy.totalCapacity}
              </span>
              <span className="text-muted-foreground">{site.occupancy.occupancyRate}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={
                  site.occupancy.occupancyRate >= 90
                    ? 'h-full rounded-full bg-destructive'
                    : site.occupancy.occupancyRate >= 70
                      ? 'h-full rounded-full bg-warning'
                      : 'h-full rounded-full bg-brand'
                }
                style={{ width: `${Math.min(100, site.occupancy.occupancyRate)}%` }}
              />
            </div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'valets',
      header: 'Valets',
      render: (site) => <span className="tabular-nums">{site._count?.valetAssignments ?? 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (site) => <ActiveBadge isActive={site.isActive} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (site) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void downloadQr(site)}>
                <QrCode /> Download QR
              </DropdownMenuItem>
              {isSuperAdmin ? (
                <>
                  <DropdownMenuItem onClick={() => { setEditingSite(site); setFormOpen(true); }}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleActive.mutate(site)}>
                    <Power /> {site.isActive ? 'Deactivate' : 'Activate'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeletingSite(site)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sites"
        description="Parking locations with live occupancy and QR codes."
        actions={
          isSuperAdmin ? (
            <Button onClick={() => { setEditingSite(null); setFormOpen(true); }}>
              <Plus /> New site
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(site) => site.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(site) => navigate(`/sites/${site.id}`)}
        emptyTitle="No sites yet"
        emptyDescription="Create your first parking site to generate its QR code."
        emptyAction={
          isSuperAdmin ? (
            <Button onClick={() => { setEditingSite(null); setFormOpen(true); }}>
              <Plus /> Create site
            </Button>
          ) : undefined
        }
        toolbar={
          <div className="flex items-center justify-between gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search sites…" />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              {data?.meta.total ?? 0} sites
            </div>
          </div>
        }
      />

      <SiteFormDialog open={formOpen} onOpenChange={setFormOpen} site={editingSite} />
      <ConfirmDialog
        open={Boolean(deletingSite)}
        onOpenChange={(open) => !open && setDeletingSite(null)}
        title={`Delete ${deletingSite?.name}?`}
        description="This permanently removes the site and its QR code. Sites with actively parked vehicles cannot be deleted."
        confirmLabel="Delete site"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deletingSite && deleteMutation.mutate(deletingSite.id)}
      />
    </div>
  );
}
