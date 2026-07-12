import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { Fragment } from 'react';

const labels: Record<string, string> = {
  sites: 'Sites',
  organizations: 'Organizations',
  employees: 'Employees',
  vehicles: 'Vehicles',
  valets: 'Valets',
  parking: 'Parking',
  reports: 'Reports',
  notifications: 'Notifications',
  settings: 'Settings',
  profile: 'Profile',
  pickups: 'Pickups',
};

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
      <Link to="/" className="flex items-center gap-1 transition-colors hover:text-foreground">
        <Home className="size-3.5" />
      </Link>
      {segments.map((segment, index) => {
        const path = `/${segments.slice(0, index + 1).join('/')}`;
        const isLast = index === segments.length - 1;
        const label = labels[segment] ?? (segment.length > 14 ? 'Details' : segment);
        return (
          <Fragment key={path}>
            <ChevronRight className="size-3.5" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link to={path} className="transition-colors hover:text-foreground">
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
