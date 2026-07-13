import {
  Bell,
  Building2,
  Car,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  MapPin,
  Settings,
  UserCircle,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: Role[];
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'VALET'] },
  { label: 'Sites', path: '/sites', icon: MapPin, roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'VALET'] },
  { label: 'Organizations', path: '/organizations', icon: Building2, roles: ['SUPER_ADMIN'] },
  { label: 'Employees', path: '/employees', icon: Users, roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
  { label: 'Vehicles', path: '/vehicles', icon: Car, roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
  { label: 'Valets', path: '/valets', icon: UserCog, roles: ['SUPER_ADMIN'] },
  { label: 'Parking', path: '/parking', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'VALET'] },
  { label: 'Reports', path: '/reports', icon: FileBarChart, roles: ['SUPER_ADMIN', 'ORG_ADMIN'] },
  { label: 'Notifications', path: '/notifications', icon: Bell, roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'VALET'] },
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'VALET'] },
  { label: 'Profile', path: '/profile', icon: UserCircle, roles: ['SUPER_ADMIN', 'ORG_ADMIN', 'VALET'] },
];

export function navForRole(role: Role): NavItem[] {
  return navItems.filter((item) => item.roles.includes(role));
}
