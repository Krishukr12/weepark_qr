import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  Building2,
  Car,
  CarFront,
  CircleParking,
  Clock,
  MapPin,
  PackageCheck,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";
import { dashboardApi } from "@/api/domain.api";
import { useAuth } from "@/context/auth-context";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard, StatCardSkeleton } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingPickupsPanel } from "@/pages/parking/pending-pickups-panel";

const CHART_COLORS = [
  "oklch(0.72 0.17 160)",
  "oklch(0.62 0.14 250)",
  "oklch(0.76 0.16 75)",
  "oklch(0.66 0.17 300)",
];

function ChartCard({
  title,
  description,
  isLoading,
  children,
}: {
  title: string;
  description?: string;
  isLoading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="h-72">
        {isLoading ? <Skeleton className="size-full" /> : children}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();

  const stats = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: dashboardApi.stats,
  });
  const trend = useQuery({
    queryKey: ["dashboard", "trend"],
    queryFn: () => dashboardApi.parkingTrend(14),
  });
  const peakHours = useQuery({
    queryKey: ["dashboard", "peak-hours"],
    queryFn: dashboardApi.peakHours,
  });
  const orgUsage = useQuery({
    queryKey: ["dashboard", "org-usage"],
    queryFn: dashboardApi.organizationUsage,
    enabled: user?.role === "SUPER_ADMIN",
  });
  const siteUsage = useQuery({
    queryKey: ["dashboard", "site-usage"],
    queryFn: dashboardApi.siteUsage,
  });

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const isValet = user?.role === "VALET";
  const isB2cOrgAdmin = user?.role === "ORG_ADMIN" && user.organizationClientType === "B2C";
  const s = stats.data;

  const cards = s
    ? [
        {
          title: "Today's Parking",
          value: s.todaysParking,
          icon: CarFront,
          tone: "brand" as const,
        },
        {
          title: "Currently Parked",
          value: s.currentParked,
          icon: CircleParking,
          tone: "default" as const,
        },
        {
          title: "Today's Pickups",
          value: s.todaysPickups,
          icon: PackageCheck,
          tone: "default" as const,
        },
        {
          title: "Pending Pickups",
          value: s.pendingPickups,
          icon: Clock,
          tone:
            s.pendingPickups > 0 ? ("warning" as const) : ("default" as const),
        },
        {
          title: "Available Spaces",
          value: s.availableSpaces,
          icon: Warehouse,
          tone: "brand" as const,
          hint: `of ${s.totalCapacity} total`,
        },
        {
          title: "Occupied Spaces",
          value: s.occupiedSpaces,
          icon: MapPin,
          tone: "default" as const,
        },
        ...(isSuperAdmin
          ? [
              {
                title: "Organizations",
                value: s.organizations,
                icon: Building2,
                tone: "default" as const,
              },
              {
                title: "Valets",
                value: s.valets,
                icon: UserCog,
                tone: "default" as const,
              },
            ]
          : []),
        ...(!isValet && !isB2cOrgAdmin
          ? [
              {
                title: "Employees",
                value: s.employees,
                icon: Users,
                tone: "default" as const,
              },
              {
                title: "Vehicles",
                value: s.vehicles,
                icon: Car,
                tone: "default" as const,
              },
            ]
          : isValet
            ? [
                {
                  title: "My Sites",
                  value: s.sites,
                  icon: MapPin,
                  tone: "default" as const,
                },
              ]
            : []),
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${user?.name.split(" ")[0] ?? ""}`}
        description="Here's what's happening across your parking operations."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {stats.isLoading
          ? Array.from({ length: 10 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))
          : cards.map((card, index) => (
              <StatCard key={card.title} {...card} index={index} />
            ))}
      </div>

      {isValet ? <PendingPickupsPanel /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Parking Trend"
          description="Parkings vs pickups — last 14 days"
          isLoading={trend.isLoading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trend.data ?? []}
              margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
            >
              <defs>
                <linearGradient id="fillParkings" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={CHART_COLORS[0]}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_COLORS[0]}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="fillPickups" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={CHART_COLORS[1]}
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_COLORS[1]}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) =>
                  format(parseISO(value), "dd MMM")
                }
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <ChartTooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                labelFormatter={(value) =>
                  format(parseISO(String(value)), "EEE, dd MMM")
                }
              />
              <Area
                type="monotone"
                dataKey="parkings"
                name="Parkings"
                stroke={CHART_COLORS[0]}
                fill="url(#fillParkings)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="pickups"
                name="Pickups"
                stroke={CHART_COLORS[1]}
                fill="url(#fillPickups)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Peak Hours"
          description="Hourly parking distribution — last 30 days"
          isLoading={peakHours.isLoading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={peakHours.data ?? []}
              margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="count"
                name="Parkings"
                fill={CHART_COLORS[0]}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {isSuperAdmin ? (
          <ChartCard
            title="Organization Usage"
            description="Parkings by organization (top 8)"
            isLoading={orgUsage.isLoading}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={orgUsage.data ?? []}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <ChartTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" name="Parkings" radius={[0, 4, 4, 0]}>
                  {(orgUsage.data ?? []).map((_, index) => (
                    <Cell
                      key={index}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}

        <ChartCard
          title="Site Usage"
          description="Parkings by site (top 8)"
          isLoading={siteUsage.isLoading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={siteUsage.data ?? []}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" name="Parkings" radius={[0, 4, 4, 0]}>
                {(siteUsage.data ?? []).map((_, index) => (
                  <Cell
                    key={index}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
