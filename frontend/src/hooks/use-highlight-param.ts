import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { highlightDomId } from '@/lib/notification-target';

/** Reads a notification highlight query param and scrolls the matching element into view. */
export function useHighlightParam(param: string, ready = true): string | null {
  const [searchParams] = useSearchParams();
  const id = searchParams.get(param);

  useEffect(() => {
    if (!id || !ready) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(highlightDomId(id))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [id, ready]);

  return id;
}
