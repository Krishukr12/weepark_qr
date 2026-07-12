import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/auth-context';
import { AppShell } from '@/components/layout/app-shell';
import { BrandLogo } from '@/components/layout/sidebar';
import { RequireAuth, RequireRole } from '@/components/layout/route-guards';
import { LoginPage } from '@/pages/auth/login';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password';
import { ResetPasswordPage } from '@/pages/auth/reset-password';
import { DashboardPage } from '@/pages/dashboard/dashboard';
import { SitesPage } from '@/pages/sites/sites';
import { SiteDetailPage } from '@/pages/sites/site-detail';
import { OrganizationsPage } from '@/pages/organizations/organizations';
import { EmployeesPage } from '@/pages/employees/employees';
import { VehiclesPage } from '@/pages/vehicles/vehicles';
import { ValetsPage } from '@/pages/valets/valets';
import { ParkingPage } from '@/pages/parking/parking';
import { ReportsPage } from '@/pages/reports/reports';
import { NotificationsPage } from '@/pages/notifications/notifications';
import { SettingsPage } from '@/pages/settings/settings';
import { ProfilePage } from '@/pages/profile/profile';
import { PublicParkingPage } from '@/pages/public/public-parking';

export function FullScreenLoader() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <BrandLogo className="size-12 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading WeePark…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { isLoading } = useAuth();

  if (isLoading) return <FullScreenLoader />;

  return (
    <Routes>
      {/* Public QR flow — physically scanned at the parking entrance */}
      <Route path="/parking/:siteCode" element={<PublicParkingPage />} />

      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Authenticated app */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route element={<RequireRole roles={['SUPER_ADMIN', 'VALET']} />}>
            <Route path="/sites" element={<SitesPage />} />
            <Route path="/sites/:id" element={<SiteDetailPage />} />
          </Route>
          <Route element={<RequireRole roles={['SUPER_ADMIN']} />}>
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/valets" element={<ValetsPage />} />
          </Route>
          <Route element={<RequireRole roles={['SUPER_ADMIN', 'ORG_ADMIN']} />}>
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
          <Route path="/parking" element={<ParkingPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
