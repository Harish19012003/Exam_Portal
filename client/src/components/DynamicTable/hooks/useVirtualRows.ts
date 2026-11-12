import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataRow } from '../types';

/** Keep at least this many rows above/below the viewport. */
const MIN_BUFFER_ROWS = 16;
/** Extra screens of rows to keep mounted so fast scroll doesn’t flash blank. */
const OVERSCAN_SCREENS = 1.5;

interface UseVirtualRowsOptions {
  paginatedRows: DataRow[];
  rowHeight: number;
  onScrollExtra?: () => void;
}

export function useVirtualRows({
  paginatedRows,
  rowHeight,
  onScrollExtra,
}: UseVirtualRowsOptions) {
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [wrapperHeight, setWrapperHeight] = useState(600);
  const rafRef = useRef<number | null>(null);
  const pendingScrollTop = useRef(0);
  const onScrollExtraRef = useRef(onScrollExtra);
  onScrollExtraRef.current = onScrollExtra;

  useEffect(() => {
    const el = scrollWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapperHeight(el.clientHeight));
    ro.observe(el);
    setWrapperHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // When the page of rows changes, snap virtual window back to the current scroll position.
  useEffect(() => {
    const el = scrollWrapperRef.current;
    if (!el) return;
    pendingScrollTop.current = el.scrollTop;
    setScrollTop(el.scrollTop);
  }, [paginatedRows]);

  const safeRowHeight = Math.max(1, rowHeight || 1);
  const rowsPerScreen = Math.max(1, Math.ceil(wrapperHeight / safeRowHeight));
  const buffer = Math.max(MIN_BUFFER_ROWS, Math.ceil(rowsPerScreen * OVERSCAN_SCREENS));

  const visibleStart = Math.max(0, Math.floor(scrollTop / safeRowHeight) - buffer);
  const visibleEnd = Math.min(
    paginatedRows.length,
    visibleStart + rowsPerScreen + buffer * 2,
  );
  const virtualRows = paginatedRows.slice(visibleStart, visibleEnd);
  const paddingTop = visibleStart * safeRowHeight;
  const paddingBottom = Math.max(0, (paginatedRows.length - visibleEnd) * safeRowHeight);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    pendingScrollTop.current = e.currentTarget.scrollTop;
    onScrollExtraRef.current?.();
    // Coalesce React updates to one per frame — avoids render backlog while scrolling fast.
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setScrollTop(pendingScrollTop.current);
    });
  }, []);

  return {
    scrollWrapperRef,
    virtualRows,
    paddingTop,
    paddingBottom,
    handleScroll,
  };
}
