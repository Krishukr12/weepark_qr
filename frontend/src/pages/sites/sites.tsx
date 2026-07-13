import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MapPin, MoreHorizontal, Pencil, Plus, Power, QrCode, Trash2, Warehouse } from 'lucide-react';
import { sitesApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { cn, downloadBlob } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useListState } from '@/hooks/use-list-state';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { SearchInput } from '@/components/shared/search-input';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ActiveBadge } from '@/components/shared/status-badge';
import { StatCard, StatCardSkeleton } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SiteFormDialog } from './site-form';
import type { Site } from '@/types';

const CHART_USED = 'oklch(0.72 0.17 160)';
const CHART_FREE = 'oklch(0.88 0.02 250)';
const CHART_WARN = 'oklch(0.76 0.16 75)';

function OccupancyBar({
  occupied,
  capacity,
  rate,
}: {
  occupied: number;
  capacity: number;
  rate: number;
}) {
  return (
    <div className="min-w-36">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">
          {occupied}/{capacity}
        </span>
        <span className="text-muted-foreground">{rate}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={
            rate >= 90
              ? 'h-full rounded-full bg-destructive'
              : rate >= 70
                ? 'h-full rounded-full bg-warning'
                : 'h-full rounded-full bg-brand'
          }
          style={{ width: `${Math.min(100, rate)}%` }}
        />
      </div>
    </div>
  );
}

function SiteUsageRing({ used, total, rate }: { used: number; total: number; rate: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, rate) / 100) * circumference;
  const stroke =
    rate >= 90 ? 'stroke-destructive' : rate >= 70 ? 'stroke-warning' : 'stroke-brand';

  return (
    <div className="relative flex size-24 items-center justify-center">
      <svg className="size-24 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" className="stroke-muted" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          className={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold tabular-nums leading-none">{used}</span>
        <span className="text-[10px] text-muted-foreground">of {total}</span>
      </div>
    </div>
  );
}

/** Org-admin Sites overview — stats, charts, and cards (no admin table). */
function OrgSitesOverview() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sites', 'org-overview'],
    queryFn: () => sitesApi.list({ page: 1, limit: 100 }),
  });

  const sites = data?.data ?? [];

  const totals = useMemo(() => {
    let allocated = 0;
    let occupied = 0;
    for (const site of sites) {
      allocated += site.orgAllocation?.allocatedSpaces ?? 0;
      occupied += site.orgAllocation?.occupied ?? 0;
    }
    return {
      sites: sites.length,
      allocated,
      occupied,
      available: Math.max(0, allocated - occupied),
      rate: allocated > 0 ? Math.round((occupied / allocated) * 100) : 0,
    };
  }, [sites]);

  const barData = useMemo(
    () =>
      sites.map((site) => ({
        name: site.name.length > 16 ? `${site.name.slice(0, 14)}…` : site.name,
        fullName: site.name,
        used: site.orgAllocation?.occupied ?? 0,
        free: site.orgAllocation?.available ?? 0,
        allocated: site.orgAllocation?.allocatedSpaces ?? 0,
      })),
    [sites],
  );

  const pieData = useMemo(
    () => [
      { name: 'In use', value: totals.occupied, color: CHART_USED },
      { name: 'Available', value: Math.max(totals.available, 0), color: CHART_FREE },
    ],
    [totals.available, totals.occupied],
  );

  if (isError) {
    return (
      <EmptyState
        icon={MapPin}
        title="Couldn't load sites"
        description={getApiErrorMessage(error)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No sites assigned"
        description="Your organization has not been assigned any parking sites yet. Contact the platform admin."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Assigned sites" value={totals.sites} icon={MapPin} index={0} />
        <StatCard title="Total allocated" value={totals.allocated} icon={Warehouse} tone="brand" index={1} hint="spaces across all sites" />
        <StatCard title="Currently parked" value={totals.occupied} icon={MapPin} tone="warning" index={2} />
        <StatCard
          title="Spaces available"
          value={totals.available}
          icon={Warehouse}
          tone={totals.available === 0 ? 'destructive' : 'brand'}
          index={3}
          hint={`${totals.rate}% of allocation in use`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Occupancy by site</CardTitle>
            <CardDescription>How your allocated spaces are used at each site.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11 }} />
                <ChartTooltip
                  formatter={(value, name) => [value, name === 'used' ? 'Parked' : 'Available']}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { fullName?: string } | undefined;
                    return row?.fullName ?? '';
                  }}
                />
                <Bar dataKey="used" stackId="a" fill={CHART_USED} radius={[0, 0, 0, 0]} />
                <Bar dataKey="free" stackId="a" fill={CHART_FREE} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Overall allocation</CardTitle>
            <CardDescription>Parked vs free across every assigned site.</CardDescription>
          </CardHeader>
          <CardContent className="flex h-72 flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="70%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: CHART_USED }} /> In use · {totals.occupied}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: CHART_FREE }} /> Free · {totals.available}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Your sites</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((site, index) => {
            const alloc = site.orgAllocation;
            const used = alloc?.occupied ?? 0;
            const total = alloc?.allocatedSpaces ?? 0;
            const available = alloc?.available ?? 0;
            const rate = alloc?.occupancyRate ?? 0;

            return (
              <motion.div
                key={site.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="h-full overflow-hidden">
                  <CardContent className="flex gap-4 p-5">
                    <SiteUsageRing used={used} total={total} rate={rate} />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-semibold tracking-tight">{site.name}</p>
                          <ActiveBadge isActive={site.isActive} />
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{site.address}</p>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {site.siteCode}
                      </Badge>
                      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                        <div>
                          <p className="text-sm font-semibold tabular-nums">{total}</p>
                          <p className="text-[10px] text-muted-foreground">Allocated</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold tabular-nums text-warning">{used}</p>
                          <p className="text-[10px] text-muted-foreground">Parked</p>
                        </div>
                        <div>
                          <p
                            className={cn(
                              'text-sm font-semibold tabular-nums',
                              available === 0 ? 'text-destructive' : 'text-brand',
                            )}
                          >
                            {available}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Free</p>
                        </div>
                      </div>
                      {rate >= 90 ? (
                        <p className="text-[11px]" style={{ color: CHART_WARN }}>
                          Nearly full — {rate}% of your allocation is in use.
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SitesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { search, setSearch, setPage, params } = useListState();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deletingSite, setDeletingSite] = useState<Site | null>(null);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['sites', params],
    queryFn: () => sitesApi.list(params),
    enabled: !isOrgAdmin,
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

  if (isOrgAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Sites"
          description="Live view of sites assigned to your organization — allocation, occupancy, and availability."
        />
        <OrgSitesOverview />
      </div>
    );
  }

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
          <OccupancyBar
            occupied={site.occupancy.occupied}
            capacity={site.occupancy.totalCapacity}
            rate={site.occupancy.occupancyRate}
          />
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
    ...(isSuperAdmin
      ? [
          {
            key: 'actions',
            header: '',
            className: 'w-12',
            render: (site: Site) => (
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
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingSite(site);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleActive.mutate(site)}>
                      <Power /> {site.isActive ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeletingSite(site)}>
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          } satisfies Column<Site>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sites"
        description={
          isSuperAdmin
            ? 'Parking locations with live occupancy and QR codes.'
            : 'Parking sites assigned to you.'
        }
        actions={
          isSuperAdmin ? (
            <Button
              onClick={() => {
                setEditingSite(null);
                setFormOpen(true);
              }}
            >
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
            <Button
              onClick={() => {
                setEditingSite(null);
                setFormOpen(true);
              }}
            >
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

      {isSuperAdmin ? (
        <>
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
        </>
      ) : null}
    </div>
  );
}
