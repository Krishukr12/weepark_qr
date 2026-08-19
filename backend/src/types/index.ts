import type { OrganizationClientType, Role } from '@prisma/client';

export interface AuthTokenPayload {
  sub: string;
  role: Role;
  organizationId: string | null;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string | null;
  organizationClientType: OrganizationClientType | null;
  isActive: boolean;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
