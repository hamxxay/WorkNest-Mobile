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
 * query values as deps): a new function starts the list over from page 1. Answers of an older query are
 * ignored. Coming back to the screen reloads the pages already shown, quietly (rows and scroll stay).
 */
export function usePagedList<T>(
  fetchPage: (page: number) => Promise<Page<T>>,
  options: { reloadOnFocus?: boolean } = {},
): PagedList<T> {
  const [items, setItemsState] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const pageRef = useRef(1);
  const loadedOnce = useRef(false);
  const loadingMoreRef = useRef(false);

  const load = useCallback(
    async (mode: "initial" | "refresh" | "quiet") => {
      const gen = ++generation.current;
      // A page that was still loading belongs to the old list: stop showing its spinner.
      loadingMoreRef.current = false;
      setLoadingMore(false);
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      setError(null);
      try {
        // Quiet reload (back on the screen): fetch every page already shown, so the list keeps its length.
        const pages = mode === "quiet" ? Math.max(1, pageRef.current) : 1;
        const results = await Promise.all(Array.from({ length: pages }, (_, i) => fetchPage(i + 1)));
        if (gen !== generation.current) return;
        const last = results[results.length - 1];
        setItemsState(results.flatMap((r) => r.items));
        setTotal(last.total);
        setHasMore(last.hasMore);
        pageRef.current = pages;
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
    pageRef.current = 1;
    load("initial");
  }, [load]);

  // Coming back to the screen (e.g. after editing a row) refreshes quietly. The focus callback has stable deps
  // (the latest load is read from a ref), so a query change does not fire a second request.
  const loadRef = useRef(load);
  loadRef.current = load;
  const reloadOnFocus = options.reloadOnFocus ?? true;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (reloadOnFocus && loadedOnce.current) loadRef.current("quiet");
    }, [reloadOnFocus]),
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    const gen = generation.current;
    const next = pageRef.current + 1;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await fetchPage(next);
      if (gen !== generation.current) return;
      setItemsState((prev) => [...prev, ...result.items]);
      setTotal(result.total);
      setHasMore(result.hasMore && result.items.length > 0);
      pageRef.current = next;
    } catch (err) {
      if (gen === generation.current) setError(errorMessage(err));
    } finally {
      // Always clear the spinner (a newer load may have started meanwhile; it reset the flags itself too).
      if (gen === generation.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [fetchPage, hasMore]);

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

  const loadRef = useRef(load);
  loadRef.current = load;
  const reloadOnFocus = options.reloadOnFocus ?? false;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (reloadOnFocus && loadedOnce.current) loadRef.current("quiet");
    }, [reloadOnFocus]),
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
