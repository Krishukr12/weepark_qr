import { useQuery } from '@tanstack/react-query';
import { FilterX } from 'lucide-react';
import { organizationsApi, sitesApi, valetsApi } from '@/api/domain.api';
import { FILTER_OPTIONS_STALE_MS } from '@/lib/realtime-invalidation';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ParkingStatus } from '@/types';

export interface ParkingFilterState {
  status?: ParkingStatus;
  siteId?: string;
  organizationId?: string;
  valetId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const STATUSES: { value: ParkingStatus; label: string }[] = [
  { value: 'PARKED', label: 'Parked' },
  { value: 'PICKUP_REQUESTED', label: 'Pickup requested' },
  { value: 'PICKUP_IN_PROGRESS', label: 'Pickup in progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const ALL = '__all__';

interface ParkingFiltersProps {
  filters: ParkingFilterState;
  onChange: (filters: ParkingFilterState) => void;
}

export function ParkingFilters({ filters, onChange }: ParkingFiltersProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const canSeeSites = user?.role !== 'ORG_ADMIN';

  const sites = useQuery({
    queryKey: ['sites', 'filter-options'],
    queryFn: () => sitesApi.list({ page: 1, limit: 100 }),
    enabled: canSeeSites,
    staleTime: FILTER_OPTIONS_STALE_MS,
  });

  const organizations = useQuery({
    queryKey: ['organizations', 'filter-options'],
    queryFn: () => organizationsApi.list({ page: 1, limit: 100 }),
    enabled: isSuperAdmin,
    staleTime: FILTER_OPTIONS_STALE_MS,
  });

  const valets = useQuery({
    queryKey: ['valets', 'filter-options'],
    queryFn: () => valetsApi.list({ page: 1, limit: 100 }),
    enabled: isSuperAdmin,
    staleTime: FILTER_OPTIONS_STALE_MS,
  });

  const set = (key: keyof ParkingFilterState, value: string | undefined) => {
    onChange({ ...filters, [key]: value === ALL ? undefined : value || undefined });
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={filters.status ?? ALL} onValueChange={(value) => set('status', value)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUSES.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {canSeeSites ? (
        <Select value={filters.siteId ?? ALL} onValueChange={(value) => set('siteId', value)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Site" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sites</SelectItem>
            {sites.data?.data.map((site) => (
              <SelectItem key={site.id} value={site.id}>
                {site.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {isSuperAdmin ? (
        <>
          <Select value={filters.organizationId ?? ALL} onValueChange={(value) => set('organizationId', value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All organizations</SelectItem>
              {organizations.data?.data.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.valetId ?? ALL} onValueChange={(value) => set('valetId', value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Valet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All valets</SelectItem>
              {valets.data?.data.map((valet) => (
                <SelectItem key={valet.id} value={valet.id}>
                  {valet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : null}

      <Input
        type="date"
        className="w-38"
        value={filters.dateFrom ?? ''}
        onChange={(e) => set('dateFrom', e.target.value)}
        aria-label="From date"
      />
      <Input
        type="date"
        className="w-38"
        value={filters.dateTo ?? ''}
        onChange={(e) => set('dateTo', e.target.value)}
        aria-label="To date"
      />

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          <FilterX /> Clear
        </Button>
      ) : null}
    </div>
  );
}
