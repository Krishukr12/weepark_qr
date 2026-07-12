import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import { CalendarRange, FileDown, FileSpreadsheet, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardApi, parkingApi } from '@/api/domain.api';
import { getApiErrorMessage } from '@/lib/api';
import { downloadBlob } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RANGE_PRESETS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

export function ReportsPage() {
  const [rangeDays, setRangeDays] = useState('30');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);

  const trend = useQuery({
    queryKey: ['dashboard', 'trend', rangeDays],
    queryFn: () => dashboardApi.parkingTrend(Number(rangeDays)),
  });

  const handlePreset = (value: string) => {
    setRangeDays(value);
    setDateFrom(format(subDays(new Date(), Number(value)), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleExport = async (type: 'csv' | 'excel') => {
    setExporting(type);
    try {
      const exportParams = {
        dateFrom: new Date(`${dateFrom}T00:00:00`).toISOString(),
        dateTo: new Date(`${dateTo}T23:59:59`).toISOString(),
      };
      const blob = type === 'csv' ? await parkingApi.exportCsv(exportParams) : await parkingApi.exportExcel(exportParams);
      downloadBlob(blob, `weepark-report-${dateFrom}-to-${dateTo}.${type === 'csv' ? 'csv' : 'xlsx'}`);
      toast.success('Report downloaded');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Export parking activity and analyze trends over time." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="size-4.5 text-brand" /> Export parking report
          </CardTitle>
          <CardDescription>Download the full parking history for a date range as CSV or Excel.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Quick range</Label>
              <Select value={rangeDays} onValueChange={handlePreset}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-from">From</Label>
              <Input id="r-from" type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-to">To</Label>
              <Input id="r-to" type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void handleExport('csv')} loading={exporting === 'csv'}>
                <FileDown /> Export CSV
              </Button>
              <Button onClick={() => void handleExport('excel')} loading={exporting === 'excel'}>
                <FileSpreadsheet /> Export Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4.5 text-brand" /> Activity trend
          </CardTitle>
          <CardDescription>Parkings and pickups over the selected quick range.</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {trend.isLoading ? (
            <Skeleton className="size-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.data ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.17 160)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="oklch(0.72 0.17 160)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => format(new Date(value), 'dd MMM')}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <ChartTooltip
                  contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="parkings" name="Parkings" stroke="oklch(0.72 0.17 160)" fill="url(#reportFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="pickups" name="Pickups" stroke="oklch(0.62 0.14 250)" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
