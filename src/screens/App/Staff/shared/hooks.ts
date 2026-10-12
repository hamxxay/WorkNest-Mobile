import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { errorMessage } from "../../../../services/apiClient";
import type { Page } from "../../../../services/staff";

// Data hooks for the staff screens. Errors are kept as readable text (errorMessage) and shown with
// ErrorState / AsyncList: a failed load never turns into an empty list.

/** Value that follows `value` after `delay` ms without changes (search boxes). */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export type PagedList<T> = {
  items: T[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  /** Pull-to-refresh (keeps the rows while reloading). */
  refresh: () => void;
  /** Reload from page 1 showing the skeleton. */
  reload: () => void;
  loadMore: () => void;
  /** Replace / remove rows locally after an action. */
  setItems: (update: (items: T[]) => T[]) => void;
};

/**
 * Paged list for AsyncList. `fetchPage` must be stable for the same query (wrap it in useCallback with the
 * query values as deps): a new function reloads from page 1. Stale answers of an older query are ignored.
 */
export function usePagedList<T>(
  fetchPage: (page: number) => Promise<Page<T>>,
  options: { reloadOnFocus?: boolean } = {},
): PagedList<T> {
  const [items, setItemsState] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const loadedOnce = useRef(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "quiet") => {
      const gen = ++generation.current;
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      try {
        const result = await fetchPage(1);
        if (gen !== generation.current) return;
        setItemsState(result.items);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setPage(1);
        loadedOnce.current = true;
      } catch (err) {
        if (gen !== generation.current) return;
        setError(errorMessage(err));
      } finally {
        if (gen === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    setItemsState([]);
    load("initial");
  }, [load]);

  // Coming back to the screen (e.g. after editing a row) refreshes quietly.
  const reloadOnFocus = options.reloadOnFocus ?? true;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (reloadOnFocus && loadedOnce.current) load("quiet");
    }, [load, reloadOnFocus]),
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const gen = generation.current;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await fetchPage(page + 1);
      if (gen !== generation.current) return;
      setItemsState((prev) => [...prev, ...next.items]);
      setTotal(next.total);
      setHasMore(next.hasMore && next.items.length > 0);
      setPage(page + 1);
    } catch (err) {
      if (gen === generation.current) setError(errorMessage(err));
    } finally {
      if (gen === generation.current) setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loadingMore, page]);

  return {
    items,
    total,
    hasMore,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh: useCallback(() => load("refresh"), [load]),
    reload: useCallback(() => load("initial"), [load]),
    loadMore,
    setItems: useCallback((update: (items: T[]) => T[]) => setItemsState(update), []),
  };
}

export type AsyncData<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload: () => void;
  refresh: () => void;
  setData: (update: T | null | ((prev: T | null) => T | null)) => void;
};

/** One object (detail screens, dashboards). `fetcher` must be stable (useCallback). */
export function useAsyncData<T>(fetcher: () => Promise<T>, options: { reloadOnFocus?: boolean } = {}): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const loadedOnce = useRef(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "quiet") => {
      const gen = ++generation.current;
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      try {
        const result = await fetcher();
        if (gen !== generation.current) return;
        setData(result);
        loadedOnce.current = true;
      } catch (err) {
        if (gen === generation.current) setError(errorMessage(err));
      } finally {
        if (gen === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetcher],
  );

  useEffect(() => {
    load("initial");
  }, [load]);

  const reloadOnFocus = options.reloadOnFocus ?? false;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (reloadOnFocus && loadedOnce.current) load("quiet");
    }, [load, reloadOnFocus]),
  );

  return {
    data,
    loading,
    refreshing,
    error,
    reload: useCallback(() => load("initial"), [load]),
    refresh: useCallback(() => load("refresh"), [load]),
    setData,
  };
}

/** Runs an action once at a time: `busy` while it runs; resolves to undefined when it failed (error shown by `onError`). */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const run = useCallback(
    async <R,>(key: string, action: () => Promise<R>, onError: (message: string) => void): Promise<R | undefined> => {
      if (busyRef.current) return undefined;
      busyRef.current = true;
      setBusy(key);
      try {
        return await action();
      } catch (err) {
        onError(errorMessage(err));
        return undefined;
      } finally {
        busyRef.current = false;
        setBusy(null);
      }
    },
    [],
  );
  return { busy, run };
}
