import type { Request } from 'express';
import type { PaginatedResult, PaginationParams } from '../types';
import { ApiError } from './apiError';

const MAX_LIMIT = 100;
const DEFAULT_SORT = ['createdAt', 'updatedAt'] as const;

export function getPagination(req: Request, allowedSort: readonly string[] = DEFAULT_SORT): PaginationParams {
  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limitRaw))) : 10;

  const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined;
  if (sortBy && !allowedSort.includes(sortBy)) {
    throw ApiError.validation('Invalid sort field', [{ field: 'sortBy', message: 'Unsupported sort field' }]);
  }

  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
  const search =
    typeof req.query.search === 'string' && req.query.search.trim()
      ? req.query.search.trim().slice(0, 100)
      : undefined;
  return { page, limit, sortBy, sortOrder, search };
}

export function buildPaginatedResult<T>(items: T[], total: number, params: PaginationParams): PaginatedResult<T> {
  return {
    items,
    meta: {
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export function toSkipTake(params: PaginationParams): { skip: number; take: number } {
  return { skip: (params.page - 1) * params.limit, take: params.limit };
}
