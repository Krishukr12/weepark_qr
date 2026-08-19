import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ClipboardList, FileDown, FileSpreadsheet } from 'lucide-react';
import { parkingApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { downloadBlob, formatDuration } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useListState } from '@/hooks/use-list-state';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { SearchInput } from '@/components/shared/search-input';
import { ParkingStatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PendingPickupsPanel } from './pending-pickups-panel';
import { ParkingFilters, type ParkingFilterState } from './parking-filters';
import type { ParkingEntry } from '@/types';

export function ParkingPage() {
  const { user } = useAuth();
  const { search, setSearch, setPage, params } = useListState();
  const [filters, setFilters] = useState<ParkingFilterState>({});
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);
  const [searchParams] = useSearchParams();
  const highlightEntryId = searchParams.get('entry');

  const queryParams = useMemo(
    () => ({
      ...params,
      ...filters,
      dateFrom: filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).toISOString() : undefined,
      dateTo: filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).toISOString() : undefined,
    }),
    [params, filters],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['parking', 'history', queryParams],
    queryFn: () => parkingApi.history(queryParams),
  });

  const highlightedEntry = useQuery({
    queryKey: ['parking', highlightEntryId],
    queryFn: () => parkingApi.get(highlightEntryId!),
    enabled: Boolean(highlightEntryId),
  });

  const rows = useMemo(() => {
    const items = data?.data ?? [];
    const extra = highlightedEntry.data;
    if (!extra) return items;
    if (items.some((row) => row.id === extra.id)) return items;
    return [extra, ...items];
  }, [data?.data, highlightedEntry.data]);

  const handleExport = async (type: 'csv' | 'excel') => {
    setExporting(type);
    try {
      const { page: _page, limit: _limit, ...exportParams } = queryParams;
      const blob = type === 'csv' ? await parkingApi.exportCsv(exportParams) : await parkingApi.exportExcel(exportParams);
      downloadBlob(blob, `weepark-history-${format(new Date(), 'yyyyMMdd-HHmm')}.${type === 'csv' ? 'csv' : 'xlsx'}`);
      toast.success(`${type === 'csv' ? 'CSV' : 'Excel'} export downloaded`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  const isB2cAdmin = user?.role === 'ORG_ADMIN' && user.organizationClientType === 'B2C';

  const columns: Column<ParkingEntry>[] = useMemo(
    () => [
    {
      key: 'ticket',
      header: 'Ticket',
      render: (entry) => <Badge variant="outline" className="font-mono text-xs">{entry.ticketCode}</Badge>,
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (entry) => (
        <div>
          <p className="font-mono text-sm font-medium">{entry.vehicle.vehicleNumber}</p>
          <p className="text-xs text-muted-foreground">
            {[entry.vehicle.brand, entry.vehicle.model].filter(Boolean).join(' ') || entry.vehicle.vehicleType}
          </p>
        </div>
      ),
    },
    {
      key: 'employee',
      header: isB2cAdmin ? 'Guest' : 'Employee',
      render: (entry) => (
        <div>
          <p className="text-sm">{entry.employee.name}</p>
          {isB2cAdmin ? (
            <p className="font-mono text-xs text-muted-foreground">{entry.employee.phone ?? '—'}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{entry.organization.name}</p>
          )}
        </div>
      ),
    },
    ...(isB2cAdmin
      ? [
          {
            key: 'phone',
            header: 'Phone',
            render: (entry: ParkingEntry) => (
              <span className="font-mono text-sm tabular-nums">{entry.employee.phone ?? '—'}</span>
            ),
          } satisfies Column<ParkingEntry>,
        ]
      : []),
    { key: 'site', header: 'Site', render: (entry) => entry.site.name },
    {
      key: 'parkedAt',
      header: 'Parked',
      render: (entry) => (
        <div>
          <p className="text-sm">{format(new Date(entry.parkedAt), 'dd MMM yyyy')}</p>
          <p className="text-xs text-muted-foreground">{format(new Date(entry.parkedAt), 'HH:mm')}</p>
        </div>
      ),
    },
    { key: 'duration', header: 'Duration', render: (entry) => formatDuration(entry.durationMinutes) },
    { key: 'valet', header: 'Valet', render: (entry) => entry.valet?.name ?? '—' },
    { key: 'status', header: 'Status', render: (entry) => <ParkingStatusBadge status={entry.status} /> },
    ],
    [isB2cAdmin],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking"
        description="Complete parking history with live status."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void handleExport('csv')} loading={exporting === 'csv'}>
              <FileDown /> CSV
            </Button>
            <Button variant="outline" onClick={() => void handleExport('excel')} loading={exporting === 'excel'}>
              <FileSpreadsheet /> Excel
            </Button>
          </div>
        }
      />

      {user?.role === 'VALET' ? <PendingPickupsPanel /> : null}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(entry) => entry.id}
        highlightedRowKey={highlightEntryId}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle="No parking records"
        emptyDescription="Records appear here as soon as vehicles park via site QR codes."
        toolbar={
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <SearchInput value={search} onChange={setSearch} placeholder={isB2cAdmin ? 'Search ticket, vehicle, phone…' : 'Search ticket, vehicle, employee…'} />
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ClipboardList className="size-4" />
                {data?.meta.total ?? 0} records
              </div>
            </div>
            <ParkingFilters filters={filters} onChange={(next) => { setFilters(next); setPage(1); }} />
          </div>
        }
      />
    </div>
  );
}
