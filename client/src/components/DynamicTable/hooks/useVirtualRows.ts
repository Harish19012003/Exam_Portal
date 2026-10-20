import { useCallback, useEffect, useRef, useState } from 'react';
import type { DataRow } from '../types';

const BUFFER_ROWS = 6;

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

  useEffect(() => {
    const el = scrollWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapperHeight(el.clientHeight));
    ro.observe(el);
    setWrapperHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const visibleStart = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER_ROWS);
  const visibleEnd = Math.min(
    paginatedRows.length,
    visibleStart + Math.ceil(wrapperHeight / rowHeight) + BUFFER_ROWS * 2,
  );
  const virtualRows = paginatedRows.slice(visibleStart, visibleEnd);
  const paddingTop = visibleStart * rowHeight;
  const paddingBottom = Math.max(0, (paginatedRows.length - visibleEnd) * rowHeight);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
      onScrollExtra?.();
    },
    [onScrollExtra],
  );

  return {
    scrollWrapperRef,
    virtualRows,
    paddingTop,
    paddingBottom,
    handleScroll,
  };
}
