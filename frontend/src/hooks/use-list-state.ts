import { useMemo, useState } from 'react';
import { useDebounce } from './use-debounce';

/**
 * Shared state for searchable, paginated list pages:
 * search box, debounced query value and page reset on new searches.
 */
export function useListState(initialLimit = 10) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);

  const params = useMemo(
    () => ({ page: debouncedSearch !== search ? 1 : page, limit: initialLimit, search: debouncedSearch || undefined }),
    [page, debouncedSearch, search, initialLimit],
  );

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return { page, setPage, search, setSearch: handleSearch, params };
}
