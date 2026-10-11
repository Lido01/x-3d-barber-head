import { useCallback, useEffect, useRef, useState } from "react";

import { fetchQuery, peek, queryKey, subscribe } from "../services/queryCache";

/**
 * Read a GET endpoint through the shared cache.
 *
 * Still the familiar `useState` + `useEffect` fetch, but the request
 * itself is delegated to `queryCache`, which is what removes the
 * redundancy the old copy-pasted hooks had:
 *
 *   - Six components reading `/api/services/` used to fire six
 *     identical requests on every navigation. Now the first one to
 *     mount makes the request and the other five reuse it.
 *   - A component mounting later renders the cached rows on its very
 *     first paint. No spinner, no request.
 *   - `fetchQuery` returns the cached value without touching the
 *     network while it is fresh, so the `useEffect` below fires on every
 *     mount and costs nothing on all but the first.
 *   - A write calls `invalidate(...)`, which refreshes the key in place;
 *     this component re-renders from its subscription, so there is no
 *     refetch loop and no screen left showing a row a write made wrong.
 *
 * The fetcher is read through a ref, so callers can pass an inline arrow
 * function without the effect restarting on every render.
 *
 * @param {string} url endpoint path, e.g. "/services/"
 * @param {(signal: AbortSignal) => Promise<unknown>} fetcher
 * @param {object} [options]
 * @param {Record<string, unknown>} [options.params] query params, part of the key
 * @param {string} [options.scope] cache variant, e.g. "staff" vs "public"
 * @param {boolean} [options.enabled] skip entirely when false
 * @param {number} [options.staleMs] how long to serve without a request
 * @param {(data: unknown) => unknown} [options.select] shape the payload
 * @returns {{ data: any, loading: boolean, error: any, refetch: () => Promise<any>, isFetching: boolean }}
 */
export function useQuery(url, fetcher, options = {}) {
  const { params, scope = "public", enabled = true, staleMs, select } = options;

  const key = params ? queryKey(url, params, scope) : queryKey(url, null, scope);

  // The fetcher is almost always an inline arrow, so it changes identity
  // on every render. Holding it in a ref keeps that out of the deps.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const selectRef = useRef(select);
  selectRef.current = select;

  const read = useCallback(() => {
    const entry = peek(key);

    if (!entry) {
      return { data: undefined, hasData: false, error: null };
    }

    const shaped =
      entry.hasData && selectRef.current ? selectRef.current(entry.data) : entry.data;

    return { data: shaped, hasData: entry.hasData, error: entry.error };
  }, [key]);

  const [snapshot, setSnapshot] = useState(read);
  const [isFetching, setIsFetching] = useState(false);

  /**
   * Effect 1 of 2: listen for changes to this key.
   *
   * Subscribing before the request goes out means the resolution cannot
   * land in the gap between the first read and the fetch. Every write
   * anywhere in the app reaches this component through here, which is
   * why nothing has to poll.
   */
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return subscribe(key, () => {
      setSnapshot(read());
    });
  }, [key, enabled, read]);

  /**
   * Effect 2 of 2: the fetch.
   *
   * Note what this does *not* do: it does not call the API. It asks the
   * cache, and the cache decides - request, or hand back what is already
   * there. That single decision is what turns six components sharing one
   * endpoint into one request instead of six.
   */
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;

    setIsFetching(true);

    fetchQuery(key, (signal) => fetcherRef.current(signal), { staleMs })
      .catch(() => {
        // The error is already recorded on the cache entry and reaches
        // this component through its subscription. Swallowing here keeps
        // it from surfacing twice.
      })
      .finally(() => {
        if (active) {
          setIsFetching(false);
        }
      });

    return () => {
      // Only stops *this* component updating. The request is shared, so
      // unmounting must not cancel it for everyone else waiting.
      active = false;
    };
  }, [key, enabled, staleMs]);

  const refetch = useCallback(
    () => fetchQuery(key, (signal) => fetcherRef.current(signal), { force: true, staleMs }),
    [key, staleMs]
  );

  return {
    data: snapshot.data,
    error: snapshot.error,
    /**
     * No answer yet. Stays false when the cache already had rows.
     *
     * An error ends it too, and that clause is load-bearing rather than
     * tidiness. The cache records a failed read as "still no data" plus an
     * error, so keying this only on `!hasData` made `loading` true for
     * good whenever the first read of a key failed. Every caller that
     * renders `loading ? <Spinner/> : error ? <Error/> : rows` was then
     * unreachable on its error branch and showed the spinner forever.
     *
     * The payment page was the visible casualty, and the worst possible
     * one: "no payment has been sent for this booking yet" is answered by
     * the backend with a 404, so a customer arriving to pay their bill -
     * which is every customer, on the first visit - sat on "Checking this
     * booking..." indefinitely and never reached the form. A request that
     * has finished is not loading, however it finished.
     */
    loading: enabled && !snapshot.hasData && !snapshot.error,
    /** A request is running behind already-rendered data. */
    isFetching: enabled && isFetching,
    refetch,
  };
}

export { invalidate as invalidateQuery } from "../services/queryCache";

/**
 * A stable empty list, for the "no data yet" case.
 *
 * `data || []` would hand back a brand new array on every render, which
 * invalidates any `useMemo` downstream and re-renders a whole table for
 * nothing. One shared frozen array keeps the identity constant.
 */
export const EMPTY_LIST = Object.freeze([]);
