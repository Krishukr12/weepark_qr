import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Copy, Download, ExternalLink, MapPin, QrCode, UserCog, Warehouse } from 'lucide-react';
import { parkingApi, sitesApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { downloadBlob, formatDuration, getInitials } from '@/lib/utils';
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
import { useState } from 'react';
import type { ParkingEntry } from '@/types';

const historyColumns: Column<ParkingEntry>[] = [
  {
    key: 'vehicle',
    header: 'Vehicle',
    render: (entry) => (
      <div>
        <p className="font-mono text-sm font-medium">{entry.vehicle.vehicleNumber}</p>
        <p className="text-xs text-muted-foreground">{[entry.vehicle.brand, entry.vehicle.model].filter(Boolean).join(' ') || entry.vehicle.vehicleType}</p>
      </div>
    ),
  },
  {
    key: 'employee',
    header: 'Employee',
    render: (entry) => (
      <div>
        <p className="text-sm">{entry.employee.name}</p>
        <p className="text-xs text-muted-foreground">{entry.organization.name}</p>
      </div>
    ),
  },
  { key: 'parkedAt', header: 'Parked at', render: (entry) => format(new Date(entry.parkedAt), 'dd MMM, HH:mm') },
  { key: 'duration', header: 'Duration', render: (entry) => formatDuration(entry.durationMinutes) },
  { key: 'valet', header: 'Valet', render: (entry) => entry.valet?.name ?? '—' },
  { key: 'status', header: 'Status', render: (entry) => <ParkingStatusBadge status={entry.status} /> },
];

export function SiteDetailPage() {
  const { id = '' } = useParams();
  const [historyPage, setHistoryPage] = useState(1);
  const [todayPage, setTodayPage] = useState(1);

  const { data: site, isLoading } = useQuery({
    queryKey: ['sites', id],
    queryFn: () => sitesApi.get(id),
    enabled: Boolean(id),
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayParking = useQuery({
    queryKey: ['parking', 'site-today', id, todayPage],
    queryFn: () => parkingApi.history({ siteId: id, dateFrom: todayStart.toISOString(), page: todayPage, limit: 10 }),
    enabled: Boolean(id),
  });

  const history = useQuery({
    queryKey: ['parking', 'site-history', id, historyPage],
    queryFn: () => parkingApi.history({ siteId: id, page: historyPage, limit: 10 }),
    enabled: Boolean(id),
  });

  const handleDownloadQr = async () => {
    if (!site) return;
    try {
      const blob = await sitesApi.downloadQr(site.id);
      downloadBlob(blob, `weepark-${site.siteCode}.png`);
      toast.success('QR code downloaded');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const copyParkingUrl = async () => {
    if (!site) return;
    await navigator.clipboard.writeText(site.parkingUrl);
    toast.success('Parking URL copied');
  };

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={site.name}
        description={site.address}
        actions={
          <div className="flex items-center gap-2">
            {site.googleMapsLink ? (
              <Button variant="outline" asChild>
                <a href={site.googleMapsLink} target="_blank" rel="noreferrer">
                  <ExternalLink /> Maps
                </a>
              </Button>
            ) : null}
            <Button onClick={() => void handleDownloadQr()}>
              <Download /> Download QR
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">{site.siteCode}</Badge>
        <ActiveBadge isActive={site.isActive} />
        {site.latitude !== null && site.longitude !== null ? (
          <Badge variant="secondary">
            <MapPin /> {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Capacity" value={site.occupancy.totalCapacity} icon={Warehouse} index={0} />
        <StatCard title="Occupied" value={site.occupancy.occupied} icon={MapPin} tone="warning" index={1} />
        <StatCard title="Available" value={site.occupancy.available} icon={Warehouse} tone="brand" index={2} />
        <StatCard title="Assigned Valets" value={site.valets.length} icon={UserCog} index={3} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* QR card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-4.5 text-brand" /> Site QR Code
            </CardTitle>
            <CardDescription>Print and paste at the parking entrance.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border bg-white p-4 shadow-soft">
              <img src={site.qrDataUrl} alt={`QR code for ${site.name}`} className="size-44" />
            </div>
            <div className="flex w-full items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs">{site.parkingUrl}</code>
              <Button variant="outline" size="icon-sm" onClick={() => void copyParkingUrl()}>
                <Copy />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Valets card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="size-4.5 text-brand" /> Assigned Valets
            </CardTitle>
            <CardDescription>Valets receive instant pickup requests for this site.</CardDescription>
          </CardHeader>
          <CardContent>
            {site.valets.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No valets assigned yet. Assign valets from the Valets page.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {site.valets.map((valet) => (
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
          <TabsTrigger value="today">Today's Parking</TabsTrigger>
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
