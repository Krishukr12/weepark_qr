import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowLeft, Copy, Download, ExternalLink, MapPin, QrCode, UserCog, Warehouse } from 'lucide-react';
import { parkingApi, sitesApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { downloadBlob, formatDuration, getInitials } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ActiveBadge, ParkingStatusBadge } from '@/components/shared/status-badge';
import { StatCard } from '@/components/shared/stat-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ParkingEntry } from '@/types';

const historyColumns: Column<ParkingEntry>[] = [
  {
    key: 'vehicle',
    header: 'Vehicle',
    render: (entry) => (
      <div>
        <p className="font-mono text-sm font-medium">{entry.vehicle?.vehicleNumber ?? '—'}</p>
        <p className="text-xs text-muted-foreground">
          {[entry.vehicle?.brand, entry.vehicle?.model].filter(Boolean).join(' ') || entry.vehicle?.vehicleType || '—'}
        </p>
      </div>
    ),
  },
  {
    key: 'employee',
    header: 'Employee',
    render: (entry) => (
      <div>
        <p className="text-sm">{entry.employee?.name ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{entry.organization?.name ?? '—'}</p>
      </div>
    ),
  },
  {
    key: 'parkedAt',
    header: 'Parked at',
    render: (entry) => {
      try {
        return format(new Date(entry.parkedAt), 'dd MMM, HH:mm');
      } catch {
        return '—';
      }
    },
  },
  { key: 'duration', header: 'Duration', render: (entry) => formatDuration(entry.durationMinutes ?? null) },
  { key: 'valet', header: 'Valet', render: (entry) => entry.valet?.name ?? '—' },
  { key: 'status', header: 'Status', render: (entry) => <ParkingStatusBadge status={entry.status} /> },
];

export function SiteDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [historyPage, setHistoryPage] = useState(1);
  const [todayPage, setTodayPage] = useState(1);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';
  const showQr = !isOrgAdmin;

  const {
    data: site,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['site-detail', id],
    queryFn: () => sitesApi.get(id),
    enabled: Boolean(id),
    retry: 1,
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayParking = useQuery({
    queryKey: ['parking', 'site-today', id, todayPage],
    queryFn: () =>
      parkingApi.history({ siteId: id, dateFrom: todayStart.toISOString(), page: todayPage, limit: 10 }),
    enabled: Boolean(id) && Boolean(site),
  });

  const history = useQuery({
    queryKey: ['parking', 'site-history', id, historyPage],
    queryFn: () => parkingApi.history({ siteId: id, page: historyPage, limit: 10 }),
    enabled: Boolean(id) && Boolean(site),
  });

  const handleDownloadQr = async () => {
    if (!site) return;
    try {
      const blob = await sitesApi.downloadQr(site.id);
      downloadBlob(blob, `weepark-${site.siteCode}.png`);
      toast.success('QR code downloaded');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const copyParkingUrl = async () => {
    if (!site?.parkingUrl) return;
    try {
      await navigator.clipboard.writeText(site.parkingUrl);
      toast.success('Parking URL copied');
    } catch {
      toast.error('Could not copy URL');
    }
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Site unavailable"
          description={getApiErrorMessage(error)}
          actions={
            <Button variant="outline" asChild>
              <Link to="/sites">
                <ArrowLeft /> Back to sites
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading || !site) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-72" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const valets = Array.isArray(site.valets) ? site.valets : [];
  const occupancy = site.occupancy;
  const totalCapacity = occupancy?.totalCapacity ?? site.totalCapacity ?? 0;
  const occupied = occupancy?.occupied ?? 0;
  const available = occupancy?.available ?? Math.max(0, totalCapacity - occupied);
  const hasCoords = typeof site.latitude === 'number' && typeof site.longitude === 'number';

  return (
    <div className="space-y-6">
      <PageHeader
        title={site.name}
        description={site.address}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/sites">
                <ArrowLeft /> Back
              </Link>
            </Button>
            {site.googleMapsLink ? (
              <Button variant="outline" asChild>
                <a href={site.googleMapsLink} target="_blank" rel="noreferrer">
                  <ExternalLink /> Maps
                </a>
              </Button>
            ) : null}
            {isSuperAdmin ? (
              <Button onClick={() => void handleDownloadQr()}>
                <Download /> Download QR
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">
          {site.siteCode}
        </Badge>
        <ActiveBadge isActive={site.isActive} />
        {hasCoords ? (
          <Badge variant="secondary">
            <MapPin /> {site.latitude!.toFixed(4)}, {site.longitude!.toFixed(4)}
          </Badge>
        ) : null}
      </div>

      {isOrgAdmin && site.orgAllocation ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Your allocation" value={site.orgAllocation.allocatedSpaces} icon={Warehouse} index={0} />
          <StatCard title="Your vehicles parked" value={site.orgAllocation.occupied} icon={MapPin} tone="warning" index={1} />
          <StatCard title="Spaces left for you" value={site.orgAllocation.available} icon={Warehouse} tone="brand" index={2} />
          <StatCard title="Site capacity" value={totalCapacity} icon={Warehouse} index={3} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Capacity" value={totalCapacity} icon={Warehouse} index={0} />
          <StatCard title="Occupied" value={occupied} icon={MapPin} tone="warning" index={1} />
          <StatCard title="Available" value={available} icon={Warehouse} tone="brand" index={2} />
          <StatCard title="Assigned Valets" value={valets.length} icon={UserCog} index={3} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {showQr ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="size-4 text-brand" /> Site QR Code
              </CardTitle>
              <CardDescription>Print and paste at the parking entrance.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {site.qrDataUrl ? (
                <div className="rounded-2xl border bg-white p-4 shadow-soft">
                  <img src={site.qrDataUrl} alt={`QR code for ${site.name}`} className="size-44" />
                </div>
              ) : (
                <div className="flex size-44 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                  QR unavailable
                </div>
              )}
              {site.parkingUrl ? (
                <div className="flex w-full items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs">
                    {site.parkingUrl}
                  </code>
                  <Button variant="outline" size="icon-sm" onClick={() => void copyParkingUrl()}>
                    <Copy />
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className={showQr ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="size-4 text-brand" /> Assigned Valets
            </CardTitle>
            <CardDescription>Valets receive instant pickup requests for this site.</CardDescription>
          </CardHeader>
          <CardContent>
            {valets.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No valets assigned yet. Assign valets from the Valets page.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {valets.map((valet) => (
                  <div key={valet.id} className="flex items-center gap-3 rounded-xl border p-3">
                    <Avatar>
                      {valet.photoUrl ? <AvatarImage src={valet.photoUrl} alt={valet.name} /> : null}
                      <AvatarFallback>{getInitials(valet.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{valet.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{valet.phone ?? valet.email}</p>
                    </div>
                    <ActiveBadge isActive={valet.isActive} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today&apos;s Parking</TabsTrigger>
          <TabsTrigger value="history">Parking History</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <DataTable
            columns={historyColumns}
            rows={todayParking.data?.data}
            rowKey={(entry) => entry.id}
            isLoading={todayParking.isLoading}
            meta={todayParking.data?.meta}
            onPageChange={setTodayPage}
            emptyTitle="No parkings today"
            emptyDescription="Vehicles parked at this site today will appear here."
          />
        </TabsContent>
        <TabsContent value="history">
          <DataTable
            columns={historyColumns}
            rows={history.data?.data}
            rowKey={(entry) => entry.id}
            isLoading={history.isLoading}
            meta={history.data?.meta}
            onPageChange={setHistoryPage}
            emptyTitle="No parking history"
            emptyDescription="Completed and active parkings will appear here."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
